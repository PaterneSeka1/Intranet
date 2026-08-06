import { redirect } from 'next/navigation'
import { cookies } from 'next/headers'
import Link from 'next/link'
import { getCurrentUser } from '@/lib/auth'
import { PlanningCalendar } from '@/components/presence/PlanningCalendar'
import type { PresenceRow, ScheduleGroup } from '@/lib/presence'
import { API_BASE } from '@/lib/api-base'

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

  const [allUsers, scheduleGroups] = await Promise.all([
    fetchUsers(token, cookieName),
    fetchScheduleGroups(token, cookieName),
  ])

  // Le CTO_ADMIN ne peut jamais gérer l'emploi du temps du PDG — seul le PDG le peut (règle
  // appliquée côté backend ; on l'anticipe ici pour ne pas proposer un choix menant à un 403).
  const users = user.role === 'CTO_ADMIN' ? allUsers.filter((u) => u.role !== 'PDG') : allUsers

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

      <PlanningCalendar users={users} scheduleGroups={scheduleGroups} />
    </div>
  )
}
