import { Injectable, NotFoundException } from '@nestjs/common'
import { PublicHoliday } from '@prisma/client'
import { PrismaService } from '../prisma/prisma.service'
import { CreatePublicHolidayDto } from './dto/create-public-holiday.dto'
import { UpdatePublicHolidayDto } from './dto/update-public-holiday.dto'

function toUtcDate(isoDate: string): Date {
  return new Date(`${isoDate}T00:00:00.000Z`)
}

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
  constructor(private readonly prisma: PrismaService) {}

  findAll() {
    return this.prisma.publicHoliday.findMany({ orderBy: { date: 'asc' } })
  }

  async isHoliday(date: Date): Promise<{ isHoliday: boolean; label: string | null }> {
    const holidays = await this.prisma.publicHoliday.findMany()
    const match = holidays.find((h) => matchesDate(h, date))
    return { isHoliday: !!match, label: match?.label ?? null }
  }

  create(dto: CreatePublicHolidayDto) {
    return this.prisma.publicHoliday.create({
      data: {
        date: toUtcDate(dto.date),
        label: dto.label,
        isRecurring: dto.isRecurring ?? false,
      },
    })
  }

  async update(id: string, dto: UpdatePublicHolidayDto) {
    try {
      return await this.prisma.publicHoliday.update({
        where: { id },
        data: {
          date: dto.date ? toUtcDate(dto.date) : undefined,
          label: dto.label,
          isRecurring: dto.isRecurring,
        },
      })
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
    return { deleted: true }
  }
}
