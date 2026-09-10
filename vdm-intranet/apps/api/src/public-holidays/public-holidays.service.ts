import { Injectable, NotFoundException } from '@nestjs/common'
import { PublicHoliday } from '@prisma/client'
import { PrismaService } from '../prisma/prisma.service'
import { CreatePublicHolidayDto } from './dto/create-public-holiday.dto'
import { UpdatePublicHolidayDto } from './dto/update-public-holiday.dto'

function toUtcDate(isoDate: string): Date {
  return new Date(`${isoDate}T00:00:00.000Z`)
}

type HolidayForMatch = Pick<PublicHoliday, 'date' | 'label' | 'isRecurring'>

// Table quasi statique (gérée à la main par un admin), relue à chaque calcul de présence/pilotage/
// rapport : un court cache mémoire évite de la re-scanner en entier à chaque appel. Même patron que
// le cache de LeaveSyncService (leave-sync.service.ts) — pas de colonne DB, juste un TTL process.
const HOLIDAYS_CACHE_TTL_MS = 5 * 60_000

function matchesDate(holiday: Pick<PublicHoliday, 'date' | 'isRecurring'>, target: Date): boolean {
  if (holiday.isRecurring) {
    return (
      holiday.date.getUTCMonth() === target.getUTCMonth() &&
      holiday.date.getUTCDate() === target.getUTCDate()
    )
  }
  return (
    holiday.date.getUTCFullYear() === target.getUTCFullYear() &&
    holiday.date.getUTCMonth() === target.getUTCMonth() &&
    holiday.date.getUTCDate() === target.getUTCDate()
  )
}

@Injectable()
export class PublicHolidaysService {
  private cache: { expiresAt: number; data: HolidayForMatch[] } | null = null

  constructor(private readonly prisma: PrismaService) {}

  findAll() {
    return this.prisma.publicHoliday.findMany({ orderBy: { date: 'asc' } })
  }

  /** Liste complète (champs utiles au rapprochement uniquement), mise en cache le temps du TTL. */
  private async loadHolidays(): Promise<HolidayForMatch[]> {
    if (this.cache && this.cache.expiresAt > Date.now()) return this.cache.data
    const data = await this.prisma.publicHoliday.findMany({
      select: { date: true, label: true, isRecurring: true },
    })
    this.cache = { expiresAt: Date.now() + HOLIDAYS_CACHE_TTL_MS, data }
    return data
  }

  async isHoliday(date: Date): Promise<{ isHoliday: boolean; label: string | null }> {
    const holidays = await this.loadHolidays()
    const match = holidays.find((h) => matchesDate(h, date))
    return { isHoliday: !!match, label: match?.label ?? null }
  }

  /**
   * Jours fériés d'une plage [from, to], sous forme de Map indexée par date ISO (YYYY-MM-DD).
   * Un seul aller-retour DB (table de taille négligeable), utilisé par les rapports de période
   * pour éviter un appel `isHoliday` par jour de la plage.
   */
  async getHolidaysInRange(from: Date, to: Date): Promise<Map<string, string | null>> {
    const holidays = await this.loadHolidays()
    const map = new Map<string, string | null>()
    for (let d = new Date(from); d <= to; d.setUTCDate(d.getUTCDate() + 1)) {
      const match = holidays.find((h) => matchesDate(h, d))
      if (match) map.set(d.toISOString().split('T')[0], match.label)
    }
    return map
  }

  create(dto: CreatePublicHolidayDto) {
    const created = this.prisma.publicHoliday.create({
      data: {
        date: toUtcDate(dto.date),
        label: dto.label,
        isRecurring: dto.isRecurring ?? false,
      },
    })
    this.cache = null
    return created
  }

  async update(id: string, dto: UpdatePublicHolidayDto) {
    try {
      const updated = await this.prisma.publicHoliday.update({
        where: { id },
        data: {
          date: dto.date ? toUtcDate(dto.date) : undefined,
          label: dto.label,
          isRecurring: dto.isRecurring,
        },
      })
      this.cache = null
      return updated
    } catch (err: unknown) {
      if ((err as { code?: string }).code === 'P2025')
        throw new NotFoundException('Jour férié introuvable.')
      throw err
    }
  }

  async remove(id: string) {
    try {
      await this.prisma.publicHoliday.delete({ where: { id } })
    } catch (err: unknown) {
      if ((err as { code?: string }).code === 'P2025')
        throw new NotFoundException('Jour férié introuvable.')
      throw err
    }
    this.cache = null
    return { deleted: true }
  }
}
