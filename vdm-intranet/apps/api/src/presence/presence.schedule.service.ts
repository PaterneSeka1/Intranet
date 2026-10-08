import { Injectable } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { PresenceStatus } from '@prisma/client'
import { PrismaService } from '../prisma/prisma.service'

const DAY_MS = 24 * 60 * 60 * 1000

export interface ScheduleSource {
  time: string | null
  source: 'mandate' | 'group' | 'individual' | 'none'
  isNightShift: boolean
}

@Injectable()
export class PresenceScheduleService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService
  ) {}

  async getScheduleSource(userId: string, date: Date): Promise<ScheduleSource> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        scheduleGroupId: true,
        individualExpectedArrivalTime: true,
        scheduleGroup: { select: { expectedArrivalTime: true, isNightShift: true } },
        mandates: {
          where: { date },
          select: { expectedArrivalTime: true, isNightShift: true },
          take: 1,
        },
      },
    })
    if (!user) return { time: null, source: 'none', isNightShift: false }

    if (user.mandates.length > 0) {
      // `??` et non `||` : un mandat qui fixe isNightShift=false doit primer sur un groupe de nuit
      // (ex: mandat "week-end" désactivant explicitement le mode nuit du groupe par défaut).
      return {
        time: user.mandates[0].expectedArrivalTime,
        source: 'mandate',
        isNightShift: user.mandates[0].isNightShift ?? user.scheduleGroup?.isNightShift ?? false,
      }
    }

    if (user.scheduleGroup) {
      return {
        time: user.scheduleGroup.expectedArrivalTime,
        source: 'group',
        isNightShift: user.scheduleGroup.isNightShift,
      }
    }

    if (user.individualExpectedArrivalTime) {
      return { time: user.individualExpectedArrivalTime, source: 'individual', isNightShift: false }
    }

    return { time: null, source: 'none', isNightShift: false }
  }

  async getDepartureScheduleSource(userId: string, date: Date): Promise<ScheduleSource> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        individualExpectedDepartureTime: true,
        scheduleGroup: { select: { expectedDepartureTime: true, isNightShift: true } },
        mandates: {
          where: { date },
          select: { expectedDepartureTime: true, isNightShift: true },
          take: 1,
        },
      },
    })
    if (!user) return { time: null, source: 'none', isNightShift: false }

    // Un mandat sans heure de départ (créé via le formulaire simple, arrivée seule) ne doit pas
    // bloquer la résolution : on retombe sur le groupe/individuel comme si aucun mandat n'existait.
    const mandate = user.mandates[0]
    if (mandate?.expectedDepartureTime) {
      return {
        time: mandate.expectedDepartureTime,
        source: 'mandate',
        isNightShift: mandate.isNightShift ?? user.scheduleGroup?.isNightShift ?? false,
      }
    }

    if (user.scheduleGroup?.expectedDepartureTime) {
      return {
        time: user.scheduleGroup.expectedDepartureTime,
        source: 'group',
        isNightShift: user.scheduleGroup.isNightShift,
      }
    }

    if (user.individualExpectedDepartureTime) {
      return {
        time: user.individualExpectedDepartureTime,
        source: 'individual',
        isNightShift: false,
      }
    }

    return { time: null, source: 'none', isNightShift: false }
  }

  /**
   * Date de poste à laquelle rattacher un pointage (arrivée, départ, connexions) fait à `now`.
   *
   * Pour un employé de jour, c'est simplement la date UTC du jour. Pour une équipe de nuit, la
   * date du calendrier ne suffit pas : un employé du poste de 00:00 qui arrive la veille à 22:00,
   * puis se reconnecte après minuit (expiration du jeton) et part à 08:00, doit voir ces trois
   * pointages rattachés à UNE seule présence — sinon une seconde présence est créée après minuit
   * (faux retard de quelques minutes) et le départ clôture celle-ci au lieu de la vraie.
   *
   * Règle : parmi les débuts de poste attendus de la veille, du jour et du lendemain (mandat >
   * groupe, comme getScheduleSource), on retient le plus proche de `now` ; s'il s'agit d'un poste
   * de nuit, sa date est la date de poste. Ex. poste 00:00 : arrivée J 22:00 → J+1 ; poste 20:00 :
   * départ J+1 05:00 → J. Les horaires individuels n'ont jamais de mode nuit : toujours le jour.
   */
  async resolveShiftDate(userId: string, now: Date): Promise<Date> {
    const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()))
    const candidates = [-1, 0, 1].map((offset) => new Date(today.getTime() + offset * DAY_MS))

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        scheduleGroup: { select: { expectedArrivalTime: true, isNightShift: true } },
        mandates: {
          where: { date: { in: candidates } },
          select: { date: true, expectedArrivalTime: true, isNightShift: true },
        },
      },
    })
    if (!user) return today

    let nearest: { date: Date; distance: number; isNightShift: boolean } | null = null
    for (const date of candidates) {
      const mandate = user.mandates.find((m) => m.date.getTime() === date.getTime())
      const time = mandate?.expectedArrivalTime ?? user.scheduleGroup?.expectedArrivalTime
      if (!time) continue
      const isNightShift = mandate
        ? (mandate.isNightShift ?? user.scheduleGroup?.isNightShift ?? false)
        : (user.scheduleGroup?.isNightShift ?? false)
      const [hour, minute] = time.split(':').map(Number)
      const start = date.getTime() + (hour * 60 + minute) * 60_000
      const distance = Math.abs(now.getTime() - start)
      if (!nearest || distance < nearest.distance) nearest = { date, distance, isNightShift }
    }

    return nearest?.isNightShift ? nearest.date : today
  }

  private calculateDelayMinutes(
    expectedTime: string,
    actualDateTime: Date,
    isNightShift = false
  ): number {
    const [expHour, expMin] = expectedTime.split(':').map(Number)
    const actualHour = actualDateTime.getUTCHours()
    const actualMin = actualDateTime.getUTCMinutes()
    let expectedTotalMins = expHour * 60 + expMin
    let actualTotalMins = actualHour * 60 + actualMin

    if (isNightShift) {
      // Équipe de nuit à cheval sur minuit (ex: arrivée 20:00, départ 05:00) : les deux heures
      // ne sont comparables que ramenées sur une même échelle continue.
      if (actualHour < 12 && expHour >= 12) {
        // Heure réelle après minuit (AM), heure attendue avant minuit (PM) : cas typique d'une
        // arrivée en retard après minuit — on décale l'heure réelle d'un jour vers l'avant.
        actualTotalMins += 24 * 60
      } else if (actualHour >= 12 && expHour < 12) {
        // Heure réelle avant minuit (PM), heure attendue après minuit (AM) : cas symétrique d'un
        // départ (avancé ou tardif) alors que la fin de poste attendue est après minuit — c'est
        // l'heure attendue qu'il faut décaler d'un jour vers l'avant, pas l'heure réelle.
        expectedTotalMins += 24 * 60
      }
    }

    return actualTotalMins - expectedTotalMins
  }

  calculatePresenceStatus(
    expectedTime: string,
    actualDateTime: Date,
    isNightShift = false
  ): { status: PresenceStatus; delayMinutes: number | null } {
    if (!expectedTime) return { status: 'PRESENT', delayMinutes: null }

    const tolerance = parseInt(this.config.get('PRESENCE_LATE_TOLERANCE_MINUTES') ?? '0', 10)
    const delay = this.calculateDelayMinutes(expectedTime, actualDateTime, isNightShift)

    return {
      status: delay > tolerance ? 'LATE' : 'PRESENT',
      delayMinutes: delay > 0 ? delay : null,
    }
  }

  /**
   * Vrai uniquement si l'heure attendue + tolérance est déjà dépassée par rapport à `now` — seul
   * moment où une absence est réelle. Avant ce seuil, l'employé n'a simplement "pas encore" pointé
   * (ex: heure attendue 09:00, il est 08:40 → pas overdue, ne doit jamais être affiché "Absent").
   */
  isArrivalOverdue(expectedTime: string, now: Date, isNightShift = false): boolean {
    const tolerance = parseInt(this.config.get('PRESENCE_LATE_TOLERANCE_MINUTES') ?? '0', 10)
    return this.calculateDelayMinutes(expectedTime, now, isNightShift) > tolerance
  }

  // Écart signé par rapport à l'heure de départ attendue : positif = parti plus tard, négatif = parti plus tôt.
  calculateDepartureDelayMinutes(
    expectedTime: string,
    actualDateTime: Date,
    isNightShift = false
  ): number {
    return this.calculateDelayMinutes(expectedTime, actualDateTime, isNightShift)
  }
}
