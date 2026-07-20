import { redirect } from 'next/navigation'
import { getCurrentUser, serverFetch } from '@/lib/auth'
import { TabsManager } from '@/components/tabs/TabsManager'
import type { Tab } from '@/lib/tabs'

const CAN_VIEW = ['CTO_ADMIN', 'PDG', 'RESPONSABLE_BU']

export default async function OngletsPage() {
  const user = await getCurrentUser()
  if (!user) redirect('/login')
  if (!CAN_VIEW.includes(user.role)) redirect('/acces-refuse')

  type BuOption = { id: string; name: string; code: string }
  const [tabsRaw, buListRaw] = await Promise.all([
    serverFetch<Tab[]>('/tabs'),
    serverFetch<BuOption[]>('/tabs/business-units'),
  ])
  const tabs = tabsRaw ?? []
  const buList = (buListRaw ?? []).sort((a, b) => a.name.localeCompare(b.name))

  const canManageAll = ['CTO_ADMIN', 'PDG'].includes(user.role)

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-xl font-bold text-gray-900">Onglets</h1>
        <p className="text-sm text-gray-500 mt-1">
          {user.role === 'PDG'
            ? 'Gestion de vos onglets — visibles sur votre accueil, ou déclinables par Business Unit'
            : canManageAll
              ? 'Gestion de tous les onglets — toutes les Business Units'
              : `Gestion des onglets de votre BU${user.businessUnit ? ` : ${user.businessUnit.name}` : ''}`}
        </p>
      </div>

      <TabsManager
        initialTabs={tabs}
        userRole={user.role}
        userBuId={user.businessUnit?.id ?? null}
        buList={buList}
        canManageAll={canManageAll}
      />
    </div>
  )
}
