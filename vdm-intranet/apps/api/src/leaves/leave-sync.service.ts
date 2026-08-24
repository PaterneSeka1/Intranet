import { Injectable, Logger } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'

export type ActiveLeave = {
  matricule: string | null
  email: string | null
  firstName: string
  lastName: string
  type: string
  startDate: string
  endDate: string
  departmentName: string | null
}

export type CongeEmployee = {
  matricule: string
  email: string | null
  firstName: string
  lastName: string
  departmentName: string | null
}

type CongeApiResponse = { employees?: ActiveLeave[] }
type CongeEmployeesApiResponse = { employees?: CongeEmployee[] }

const CACHE_TTL_MS = 60_000
// Le référentiel des employés change rarement (embauches/départs) contrairement aux congés —
// cache plus long pour ne pas solliciter CONGE à chaque ouverture du formulaire de création.
const EMPLOYEES_CACHE_TTL_MS = 5 * 60_000
const REQUEST_TIMEOUT_MS = 5_000

function toDateKey(date: Date): string {
  return date.toISOString().split('T')[0]
}

/// Passerelle vers l'app externe VEDEM/CONGE (source de vérité des congés).
/// Dégrade en silence (retourne []) si l'intégration n'est pas configurée ou indisponible —
/// la présence ne doit jamais planter à cause d'un service RH externe hors ligne.
@Injectable()
export class LeaveSyncService {
  private readonly logger = new Logger(LeaveSyncService.name)
  private cache = new Map<string, { expiresAt: number; data: ActiveLeave[] }>()
  private employeesCache: { expiresAt: number; data: CongeEmployee[] } | null = null

  constructor(private readonly config: ConfigService) {}

  private getConfig(): { baseUrl: string; secret: string } | null {
    const baseUrl = this.config.get<string>('CONGE_API_URL')
    const secret = this.config.get<string>('CONGE_API_SECRET')
    if (!baseUrl || !secret) return null
    return { baseUrl: baseUrl.replace(/\/+$/, ''), secret }
  }

  /// Permet à l'appelant de distinguer "intégration désactivée" de "aucun résultat" —
  /// utile pour le formulaire de création d'employé (message adapté selon le cas).
  isConfigured(): boolean {
    return this.getConfig() !== null
  }

  async getActiveLeaves(date: Date): Promise<ActiveLeave[]> {
    return this.fetchLeaves(`date=${toDateKey(date)}`, toDateKey(date))
  }

  async getActiveLeavesInRange(from: Date, to: Date): Promise<ActiveLeave[]> {
    const key = `${toDateKey(from)}_${toDateKey(to)}`
    return this.fetchLeaves(`from=${toDateKey(from)}&to=${toDateKey(to)}`, key)
  }

  /// Référentiel des employés CONGE — alimente la sélection proposée à la création d'un
  /// employé Intranet (cf. matchLeaveToUser : matricule CONGE == username Intranet).
  async getEmployees(): Promise<CongeEmployee[]> {
    const config = this.getConfig()
    if (!config) return []

    if (this.employeesCache && this.employeesCache.expiresAt > Date.now()) {
      return this.employeesCache.data
    }

    try {
      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)
      const res = await fetch(`${config.baseUrl}/api/employees`, {
        headers: { 'x-intranet-secret': config.secret },
        signal: controller.signal,
      })
      clearTimeout(timeout)

      if (!res.ok) {
        this.logger.warn(`Congé API (/api/employees) a répondu ${res.status}`)
        return []
      }

      const body = (await res.json()) as CongeEmployeesApiResponse
      const data = Array.isArray(body.employees) ? body.employees : []
      this.employeesCache = { expiresAt: Date.now() + EMPLOYEES_CACHE_TTL_MS, data }
      return data
    } catch (err: unknown) {
      this.logger.warn(
        `Impossible de contacter l'API Congé (/api/employees) : ${(err as Error).message}`
      )
      return []
    }
  }

  private async fetchLeaves(query: string, cacheKey: string): Promise<ActiveLeave[]> {
    const config = this.getConfig()
    if (!config) return []

    const cached = this.cache.get(cacheKey)
    if (cached && cached.expiresAt > Date.now()) return cached.data

    try {
      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)
      const res = await fetch(`${config.baseUrl}/api/leaves/active?${query}`, {
        headers: { 'x-intranet-secret': config.secret },
        signal: controller.signal,
      })
      clearTimeout(timeout)

      if (!res.ok) {
        this.logger.warn(`Congé API a répondu ${res.status} pour "${query}"`)
        return []
      }

      const body = (await res.json()) as CongeApiResponse
      const data = Array.isArray(body.employees) ? body.employees : []
      this.cache.set(cacheKey, { expiresAt: Date.now() + CACHE_TTL_MS, data })
      return data
    } catch (err: unknown) {
      this.logger.warn(`Impossible de contacter l'API Congé : ${(err as Error).message}`)
      return []
    }
  }
}
