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
          select: { expectedArrivalTime: true },
          take: 1,
        },
      },
    })
    if (!user) return { time: null, source: 'none', isNightShift: false }

    if (user.mandates.length > 0) {
      return {
        time: user.mandates[0].expectedArrivalTime,
        source: 'mandate',
        isNightShift: user.scheduleGroup?.isNightShift ?? false,
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
      },
    })
    if (!user) return { time: null, source: 'none', isNightShift: false }

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
    const expectedTotalMins = expHour * 60 + expMin
    let actualTotalMins = actualHour * 60 + actualMin

    // Gestion équipes de nuit : si l'heure réelle est en AM et l'heure attendue en PM
    if (isNightShift && actualHour < 12 && expHour >= 12) {
      actualTotalMins += 24 * 60
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

  // Écart signé par rapport à l'heure de départ attendue : positif = parti plus tard, négatif = parti plus tôt.
  calculateDepartureDelayMinutes(
    expectedTime: string,
    actualDateTime: Date,
    isNightShift = false
  ): number {
    return this.calculateDelayMinutes(expectedTime, actualDateTime, isNightShift)
  }
}
