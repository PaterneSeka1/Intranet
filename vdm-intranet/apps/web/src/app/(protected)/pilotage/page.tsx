import { redirect } from 'next/navigation'
import { getCurrentUser } from '@/lib/auth'
import { PilotageClient } from '@/components/pilotage/PilotageClient'

const CAN_VIEW = ['CTO_ADMIN', 'PDG', 'DAF', 'RESPONSABLE_BU', 'RESPONSABLE_POLE']

export default async function PilotagePage() {
  const user = await getCurrentUser()
  if (!user) redirect('/login')
  if (!CAN_VIEW.includes(user.role)) redirect('/acces-refuse')

  return (
    <div className="p-6">
      <PilotageClient role={user.role} />
    </div>
  )
}
