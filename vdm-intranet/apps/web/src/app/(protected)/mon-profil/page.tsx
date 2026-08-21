import { redirect } from 'next/navigation'
import { getCurrentUser } from '@/lib/auth'
import Link from 'next/link'
import { MonProfilClient } from '@/components/profile/MonProfilClient'

export default async function MonProfilPage() {
  const user = await getCurrentUser()
  if (!user) redirect('/login')

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Mon profil</h1>
          <p className="text-sm text-gray-500 mt-1">
            Gérez vos informations personnelles et votre mot de passe.
          </p>
        </div>
        <Link
          href="/accueil"
          className="text-sm text-gray-500 hover:text-gray-800 border border-gray-200 px-4 py-2 rounded-xl transition-colors"
        >
          ← Accueil
        </Link>
      </div>
      <MonProfilClient user={user} />
    </div>
  )
}
