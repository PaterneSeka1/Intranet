import type { EmployeeOnLeave } from '@/lib/leaves'
import { ROLE_LABELS } from '@/types/user'

function fmtDate(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', timeZone: 'UTC' })
}

export function EmployeesOnLeaveCard({ employees }: { employees: EmployeeOnLeave[] }) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 sm:p-6">
      <div className="flex items-center justify-between mb-5">
        <h2 className="text-sm font-bold text-gray-800 flex items-center gap-2">
          <span className="w-8 h-8 rounded-xl bg-blue-50 flex items-center justify-center text-base">
            🌴
          </span>
          Employés en congé
        </h2>
        <span className="text-xs font-bold px-3 py-1 rounded-full bg-blue-100 text-blue-700">
          {employees.length}
        </span>
      </div>

      {employees.length === 0 ? (
        <p className="text-sm text-gray-400">Aucun employé en congé aujourd&apos;hui.</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {employees.map((e) => (
            <div
              key={e.id}
              className="border border-gray-100 rounded-xl px-3.5 py-3 flex items-center gap-3"
            >
              <span className="w-9 h-9 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center text-sm font-bold shrink-0">
                {(e.fullName ?? e.username).charAt(0).toUpperCase()}
              </span>
              <div className="min-w-0">
                <div className="text-sm font-semibold text-gray-800 truncate">
                  {e.fullName ?? e.username}
                </div>
                <div className="text-[11px] text-gray-400 truncate">
                  {ROLE_LABELS[e.role as keyof typeof ROLE_LABELS] ?? e.role}
                  {e.businessUnit ? ` · ${e.businessUnit.name}` : ''}
                </div>
                <div className="text-[11px] text-blue-600 font-medium mt-0.5">
                  Du {fmtDate(e.startDate)} au {fmtDate(e.endDate)}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
