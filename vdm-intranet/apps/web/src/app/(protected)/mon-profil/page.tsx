import { redirect } from 'next/navigation'
import { getCurrentUser } from '@/lib/auth'
import { MonProfilClient } from '@/components/profile/MonProfilClient'

export default async function MonProfilPage() {
  const user = await getCurrentUser()
  if (!user) redirect('/login')

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-xl font-bold text-gray-900">Mon profil</h1>
        <p className="text-sm text-gray-500 mt-1">Gérez vos informations personnelles et votre mot de passe.</p>
      </div>
      <MonProfilClient user={user} />
    </div>
  )
}
