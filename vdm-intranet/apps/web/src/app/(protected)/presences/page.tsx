import { redirect } from 'next/navigation'
import { cookies } from 'next/headers'
import { getCurrentUser } from '@/lib/auth'
import { PresencesPageClient } from '@/components/presence/PresencesPageClient'
import type { PresenceRow } from '@/lib/presence'
import type { Mandate } from '@/components/presence/MandatesManager'
import { API_BASE } from '@/lib/api-base'

const ACCUEIL_ONLY = ['CONSULTANT', 'STAGIAIRE', 'PRESTATAIRE']

async function fetchPresences(token: string, cookieName: string, date: string): Promise<PresenceRow[]> {
  try {
    const res = await fetch(
      `${API_BASE}/api/presence/today/all?date=${date}`,
      { headers: { Cookie: `${cookieName}=${token}` }, cache: 'no-store' },
    )
    if (!res.ok) return []
    return res.json()
  } catch { return [] }
}

async function fetchMandates(token: string, cookieName: string, date: string): Promise<Mandate[]> {
  try {
    const res = await fetch(
      `${API_BASE}/api/presence/mandates?date=${date}`,
      { headers: { Cookie: `${cookieName}=${token}` }, cache: 'no-store' },
    )
    if (!res.ok) return []
    return res.json()
  } catch { return [] }
}

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/

function todayIso(): string {
  const d = new Date()
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`
}

function sanitizeDate(param: string | undefined): string {
  const today = todayIso()
  if (!param || !ISO_DATE_RE.test(param)) return today
  return param > today ? today : param
}

interface Props {
  searchParams: Promise<{ date?: string }>
}

export default async function PresencesPage({ searchParams }: Props) {
  const user = await getCurrentUser()
  if (!user) redirect('/login')
  if (ACCUEIL_ONLY.includes(user.role)) redirect('/acces-refuse')

  const { date: dateParam } = await searchParams
  const date = sanitizeDate(dateParam)

  const cookieStore = await cookies()
  const cookieName = process.env.COOKIE_NAME ?? 'vdm_token'
  const token = cookieStore.get(cookieName)?.value ?? ''

  const [rows, mandates] = await Promise.all([
    fetchPresences(token, cookieName, date),
    fetchMandates(token, cookieName, date),
  ])

  const canMandate = ['CTO_ADMIN', 'RESPONSABLE_BU', 'RESPONSABLE_POLE'].includes(user.role)

  return (
    <PresencesPageClient
      rows={rows}
      mandates={mandates}
      date={date}
      canMandate={canMandate}
      currentUserId={user.id}
    />
  )
}
