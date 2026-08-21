import { Injectable } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { PresenceStatus } from '@prisma/client'
import { PrismaService } from '../prisma/prisma.service'

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
