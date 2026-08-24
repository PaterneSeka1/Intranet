import { Injectable } from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'
import { LeaveSyncService, type CongeEmployee } from './leave-sync.service'
import { matchLeaveToUser } from './leave-match.util'

function getToday(): Date {
  const now = new Date()
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()))
}

export type EmployeeOnLeave = {
  id: string
  fullName: string | null
  username: string
  role: string
  businessUnit: { id: string; name: string } | null
  startDate: string
  endDate: string
}

@Injectable()
export class LeavesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly leaveSync: LeaveSyncService
  ) {}

  // Volontairement dépourvu du type de congé et de l'email : ce endpoint est visible par
  // toute l'entreprise sans restriction de rôle, or certains types (maladie, menstruel,
  // maternité...) sont des données de santé sensibles qui ne doivent pas être diffusées
  // au-delà de la simple mention "en congé, du/au".
  async getOnLeaveToday(): Promise<{ date: string; employees: EmployeeOnLeave[] }> {
    const today = getToday()
    const activeLeaves = await this.leaveSync.getActiveLeaves(today)
    if (activeLeaves.length === 0) {
      return { date: today.toISOString().split('T')[0], employees: [] }
    }

    const users = await this.prisma.user.findMany({
      where: { isActive: true },
      select: {
        id: true,
        username: true,
        email: true,
        fullName: true,
        role: true,
        businessUnit: { select: { id: true, name: true } },
      },
      orderBy: [{ lastName: 'asc' }],
    })

    const employees: EmployeeOnLeave[] = []
    for (const user of users) {
      const leave = activeLeaves.find((l) => matchLeaveToUser(l, user))
      if (!leave) continue
      employees.push({
        id: user.id,
        fullName: user.fullName,
        username: user.username,
        role: user.role,
        businessUnit: user.businessUnit,
        startDate: leave.startDate,
        endDate: leave.endDate,
      })
    }

    return { date: today.toISOString().split('T')[0], employees }
  }

  // Alimente le formulaire de création d'employé : ne propose que les employés CONGE qui
  // n'ont pas déjà un compte Intranet (rapprochement matricule/email), pour garantir qu'on
  // crée bien "le même employé" et éviter les doublons de sélection.
  async getCongeEmployeeCandidates(): Promise<{
    configured: boolean
    employees: CongeEmployee[]
  }> {
    const configured = this.leaveSync.isConfigured()
    if (!configured) return { configured, employees: [] }

    const employees = await this.leaveSync.getEmployees()
    if (employees.length === 0) return { configured, employees: [] }

    const users = await this.prisma.user.findMany({
      select: { username: true, email: true },
    })

    const candidates = employees.filter(
      (employee) => !users.some((user) => matchLeaveToUser(employee, user))
    )

    return { configured, employees: candidates }
  }
}
