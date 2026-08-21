import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { getCurrentUser, serverFetch } from '@/lib/auth'
import { EmployeeReportPanel } from '@/components/users/EmployeeReportPanel'
import { ROLE_LABELS, type Role, type User } from '@/types/user'

// Même périmètre que la liste (utilisateurs/page.tsx) et que CAN_VIEW_REPORTS côté API
// (reports.service.ts::buildUserWhere) — qui peut voir la liste peut ouvrir une fiche et
// générer son rapport ; le scope BU/Pôle est de toute façon appliqué côté API.
const CAN_VIEW = ['CTO_ADMIN', 'PDG', 'DAF', 'RESPONSABLE_BU', 'RESPONSABLE_POLE']

const ROLE_BADGE: Record<Role, string> = {
  CTO_ADMIN: 'bg-red-100 text-red-700',
  PDG: 'bg-orange-100 text-orange-700',
  DAF: 'bg-yellow-100 text-yellow-700',
  RESPONSABLE_BU: 'bg-blue-100 text-blue-700',
  RESPONSABLE_POLE: 'bg-indigo-100 text-indigo-700',
  EMPLOYE: 'bg-slate-100 text-slate-600',
  CONSULTANT: 'bg-gray-100 text-gray-600',
  STAGIAIRE: 'bg-green-100 text-green-700',
  PRESTATAIRE: 'bg-purple-100 text-purple-700',
}

function getInitials(firstName: string, lastName: string, username: string): string {
  const f = firstName.trim()
  const l = lastName.trim()
  if (f && l) return (f[0] + l[0]).toUpperCase()
  if (f) return f.slice(0, 2).toUpperCase()
  return username.slice(0, 2).toUpperCase()
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wide mb-0.5">
        {label}
      </div>
      <div className="text-sm text-gray-700">{value || <span className="text-gray-300">—</span>}</div>
    </div>
  )
}

export default async function EmployeeFichePage({ params }: { params: { id: string } }) {
  const currentUser = await getCurrentUser()
  if (!currentUser) redirect('/login')
  if (!CAN_VIEW.includes(currentUser.role)) redirect('/acces-refuse')

  const employee = await serverFetch<User>(`/users/${params.id}`)
  if (!employee) notFound()

  const name = employee.fullName ?? `${employee.firstName ?? ''} ${employee.lastName ?? ''}`.trim()
  const initials = getInitials(employee.firstName ?? '', employee.lastName ?? '', employee.username)

  return (
    <div className="p-6 space-y-6 max-w-4xl mx-auto">
      <Link
        href="/utilisateurs"
        className="inline-flex items-center gap-1.5 text-xs font-semibold text-gray-400 hover:text-[#F28C38] transition-colors"
      >
        ← Retour aux utilisateurs
      </Link>

      {/* Carte d'identité */}
      <div className="bg-white rounded-2xl border border-gray-100 p-5">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-[#F28C38] flex items-center justify-center shrink-0">
            <span className="text-white text-lg font-bold">{initials}</span>
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-lg font-bold text-gray-900">{name || employee.username}</h1>
              <span
                className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${ROLE_BADGE[employee.role]}`}
              >
                {ROLE_LABELS[employee.role]}
              </span>
              <span
                className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${employee.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-400'}`}
              >
                {employee.isActive ? 'Actif' : 'Inactif'}
              </span>
            </div>
            <div className="text-xs text-gray-400 font-mono mt-0.5">{employee.username}</div>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mt-5 pt-5 border-t border-gray-50">
          <InfoRow label="Email" value={employee.email ?? ''} />
          <InfoRow label="Business Unit" value={employee.businessUnit?.name ?? ''} />
          <InfoRow label="Pôle" value={employee.pole?.name ?? ''} />
          <InfoRow label="Manager" value={employee.manager?.fullName ?? ''} />
        </div>
      </div>

      <EmployeeReportPanel userId={employee.id} username={employee.username} />
    </div>
  )
}
