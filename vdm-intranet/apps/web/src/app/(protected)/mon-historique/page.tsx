import { redirect } from 'next/navigation'
import { cookies } from 'next/headers'
import { getCurrentUser } from '@/lib/auth'
import Link from 'next/link'
import { MonHistoriqueClient, type ConnectionLog } from '@/components/historique/MonHistoriqueClient'
import { API_BASE } from '@/lib/api-base'

async function getMyConnections(): Promise<ConnectionLog[]> {
  try {
    const cookieStore = await cookies()
    const cookieName = process.env.COOKIE_NAME ?? 'vdm_token'
    const token = cookieStore.get(cookieName)?.value
    if (!token) return []
    const res = await fetch(
      `${API_BASE}/api/presence/my-connections?limit=200`,
      { headers: { Cookie: `${cookieName}=${token}` }, cache: 'no-store' },
    )
    if (!res.ok) return []
    return res.json()
  } catch {
    return []
  }
}

export default async function MonHistoriquePage() {
  const user = await getCurrentUser()
  if (!user) redirect('/login')

  const logs = await getMyConnections()
  const showGeolocation = !['CONSULTANT', 'STAGIAIRE', 'PRESTATAIRE'].includes(user.role)

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Mon historique</h1>
          <p className="text-sm text-gray-500 mt-0.5">Historique de mes connexions</p>
        </div>
        <Link
          href="/accueil"
          className="text-sm text-gray-500 hover:text-gray-800 border border-gray-200 px-4 py-2 rounded-xl transition-colors"
        >
          ← Accueil
        </Link>
      </div>

      <MonHistoriqueClient logs={logs} showGeolocation={showGeolocation} />
    </div>
  )
}
