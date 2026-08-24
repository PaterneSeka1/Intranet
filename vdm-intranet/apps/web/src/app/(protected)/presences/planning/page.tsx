import { redirect } from 'next/navigation'
import { cookies } from 'next/headers'
import Link from 'next/link'
import { getCurrentUser } from '@/lib/auth'
import { PlanningCalendar } from '@/components/presence/PlanningCalendar'
import { ScheduleGroupsManager } from '@/components/presence/ScheduleGroupsManager'
import { filterMandatableUsers } from '@/lib/mandate'
import type { PresenceRow, ScheduleGroup } from '@/lib/presence'
import { API_BASE } from '@/lib/api-base'

type PoleOption = { id: string; name: string; businessUnitId: string }

async function fetchUsers(token: string, cookieName: string): Promise<PresenceRow['user'][]> {
  try {
    const res = await fetch(`${API_BASE}/api/presence/today/all`, {
      headers: { Cookie: `${cookieName}=${token}` },
      cache: 'no-store',
    })
    if (!res.ok) return []
    const rows: PresenceRow[] = await res.json()
    return rows.map((r) => r.user)
  } catch {
    return []
  }
}

async function fetchScheduleGroups(token: string, cookieName: string): Promise<ScheduleGroup[]> {
  try {
    const res = await fetch(`${API_BASE}/api/presence/schedule-groups`, {
      headers: { Cookie: `${cookieName}=${token}` },
      cache: 'no-store',
    })
    if (!res.ok) return []
    return res.json()
  } catch {
    return []
  }
}

async function fetchPoles(token: string, cookieName: string): Promise<PoleOption[]> {
  try {
    const res = await fetch(`${API_BASE}/api/tabs/poles`, {
      headers: { Cookie: `${cookieName}=${token}` },
      cache: 'no-store',
    })
    if (!res.ok) return []
    return res.json()
  } catch {
    return []
  }
}

export default async function PlanningPage() {
  const user = await getCurrentUser()
  if (!user) redirect('/login')

  const canMandate = ['CTO_ADMIN', 'PDG', 'DAF', 'RESPONSABLE_BU', 'RESPONSABLE_POLE'].includes(
    user.role
  )
  if (!canMandate) redirect('/presences')

  const cookieStore = await cookies()
  const cookieName = process.env.COOKIE_NAME ?? 'vdm_token'
  const token = cookieStore.get(cookieName)?.value ?? ''

  const [allUsers, scheduleGroups, allPoles] = await Promise.all([
    fetchUsers(token, cookieName),
    fetchScheduleGroups(token, cookieName),
    fetchPoles(token, cookieName),
  ])

  // Seul RESPONSABLE_BU gère ses propres groupes horaires depuis cette page
  // (CAN_MANAGE_SCHEDULE_GROUPS_BU_SCOPE côté API) — CTO_ADMIN les gère globalement via /parametres.
  const canManageOwnScheduleGroups = user.role === 'RESPONSABLE_BU' && !!user.businessUnit

  // Un employé n'apparaît dans le sélecteur que si l'utilisateur peut réellement définir son emploi
  // du temps (BU/pôle + règle d'auto-mandat, cf. canMandateUser côté backend) — sinon la liste de
  // présences visible (ex. DAF, désormais globale) suggérerait à tort un droit qu'elle n'a pas.
  const users = filterMandatableUsers(
    {
      id: user.id,
      role: user.role,
      businessUnit: user.businessUnit ?? null,
      pole: user.pole ?? null,
    },
    allUsers
  )

  return (
    <div className="p-6">
      <div className="mb-6">
        <Link
          href="/presences"
          className="text-xs font-semibold text-gray-400 hover:text-[#F28C38]"
        >
          ← Retour aux présences
        </Link>
        <h1 className="text-xl font-bold text-gray-800 mt-2">Planning mensuel</h1>
        <p className="text-sm text-gray-500 mt-1">
          Configurez des horaires variables par jour, semaine ou mois — utile pour les rotations
          jour/nuit/week-end (ex : Pôle TV/Radio).
        </p>
      </div>

      {canManageOwnScheduleGroups && user.businessUnit && (
        <ScheduleGroupsManager
          initialGroups={scheduleGroups}
          businessUnitId={user.businessUnit.id}
          businessUnitName={user.businessUnit.name}
          poles={allPoles.filter((p) => p.businessUnitId === user.businessUnit!.id)}
        />
      )}

      <PlanningCalendar users={users} scheduleGroups={scheduleGroups} />
    </div>
  )
}
