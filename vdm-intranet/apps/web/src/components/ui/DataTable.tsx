'use client'

import { useState, useMemo } from 'react'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type Column<T> = {
  key: string
  label: string
  sortable?: boolean
  className?: string
  headerClass?: string
  render?: (row: T) => React.ReactNode
  sortValue?: (row: T) => string | number | null | undefined
}

type SortState = { key: string; dir: 'asc' | 'desc' } | null

interface DataTableProps<T> {
  data: T[]
  columns: Column<T>[]
  rowKey: (row: T) => string
  defaultPageSize?: number
  pageSizes?: number[]
  searchable?: boolean
  searchPlaceholder?: string
  filterFn?: (row: T, query: string) => boolean
  emptyMessage?: string
  loading?: boolean
  actions?: (row: T) => React.ReactNode
  onRowClick?: (row: T) => void
  header?: React.ReactNode
  defaultSort?: { key: string; dir: 'asc' | 'desc' }
  compact?: boolean
  /** Clé unique pour persister la page courante dans sessionStorage (survit aux rechargements) */
  storageKey?: string
}

// ---------------------------------------------------------------------------
// Page number algorithm — smart ellipsis
// ---------------------------------------------------------------------------

function buildPages(total: number, current: number): (number | '…')[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1)

  const show = new Set<number>([1, total])
  for (let i = Math.max(1, current - 2); i <= Math.min(total, current + 2); i++) show.add(i)

  const arr = Array.from(show).sort((a, b) => a - b)
  const result: (number | '…')[] = []
  for (let i = 0; i < arr.length; i++) {
    if (i > 0 && arr[i] - arr[i - 1] > 1) result.push('…')
    result.push(arr[i])
  }
  return result
}

// ---------------------------------------------------------------------------
// DataTable
// ---------------------------------------------------------------------------

function readStoredPage(key: string | undefined): number {
  if (!key || typeof window === 'undefined') return 1
  const v = sessionStorage.getItem(`dt_page_${key}`)
  const n = v ? parseInt(v, 10) : 1
  return Number.isFinite(n) && n >= 1 ? n : 1
}

function saveStoredPage(key: string | undefined, page: number) {
  if (!key || typeof window === 'undefined') return
  sessionStorage.setItem(`dt_page_${key}`, String(page))
}

export function DataTable<T>({
  data,
  columns,
  rowKey,
  defaultPageSize = 25,
  pageSizes = [10, 25, 50, 100],
  searchable = false,
  searchPlaceholder = 'Rechercher…',
  filterFn,
  emptyMessage = 'Aucun résultat.',
  loading = false,
  actions,
  onRowClick,
  header,
  defaultSort,
  compact = false,
  storageKey,
}: DataTableProps<T>) {
  const [sort, setSort] = useState<SortState>(defaultSort ?? null)
  const [page, setPage] = useState(() => readStoredPage(storageKey))
  const [pageSize, setPageSize] = useState(defaultPageSize)
  const [search, setSearch] = useState('')

  function goToPage(n: number) {
    setPage(n)
    saveStoredPage(storageKey, n)
  }

  // Filtered
  const filtered = useMemo(() => {
    if (!search.trim() || !filterFn) return data
    const q = search.toLowerCase()
    return data.filter((row) => filterFn(row, q))
  }, [data, search, filterFn])

  // Sorted
  const sorted = useMemo(() => {
    if (!sort) return filtered
    const col = columns.find((c) => c.key === sort.key)
    if (!col) return filtered

    return [...filtered].sort((a, b) => {
      const av = col.sortValue ? col.sortValue(a) : (a as Record<string, unknown>)[sort.key]
      const bv = col.sortValue ? col.sortValue(b) : (b as Record<string, unknown>)[sort.key]
      const as = av == null ? '' : String(av).toLowerCase()
      const bs = bv == null ? '' : String(bv).toLowerCase()
      return sort.dir === 'asc' ? as.localeCompare(bs) : bs.localeCompare(as)
    })
  }, [filtered, sort, columns])

  // Pagination — clamp page when total changes
  const totalPages = Math.max(1, Math.ceil(sorted.length / pageSize))
  const safePage = Math.min(page, totalPages)
  const from = sorted.length === 0 ? 0 : (safePage - 1) * pageSize + 1
  const to = Math.min(safePage * pageSize, sorted.length)

  const paginated = useMemo(() => {
    const start = (safePage - 1) * pageSize
    return sorted.slice(start, start + pageSize)
  }, [sorted, safePage, pageSize])

  function toggleSort(key: string) {
    setSort((prev) => {
      if (!prev || prev.key !== key) return { key, dir: 'asc' }
      if (prev.dir === 'asc') return { key, dir: 'desc' }
      return null
    })
    goToPage(1)
  }

  const hasActions = Boolean(actions)
  const cellPad = compact ? 'px-3 py-2' : 'px-4 py-3'
  const headPad = compact ? 'px-3 py-2.5' : 'px-4 py-3'

  return (
    <div className="flex flex-col gap-0">
      {/* Top bar */}
      {(searchable || header) && (
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          {searchable && (
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-300 text-sm pointer-events-none">
                ⌕
              </span>
              <input
                type="text"
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value)
                  goToPage(1)
                }}
                placeholder={searchPlaceholder}
                className="pl-8 pr-8 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#F28C38]/20 focus:border-[#F28C38] w-56 bg-white transition-shadow"
              />
              {search && (
                <button
                  type="button"
                  aria-label="Effacer la recherche"
                  onClick={() => {
                    setSearch('')
                    goToPage(1)
                  }}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-300 hover:text-gray-500 text-lg leading-none"
                >
                  ×
                </button>
              )}
            </div>
          )}
          {header && <div className="flex items-center gap-3 ml-auto">{header}</div>}
        </div>
      )}

      {/* Table card */}
      <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100">
                {columns.map((col) => {
                  const currentDir = sort?.key === col.key ? sort.dir : null
                  return (
                    <th
                      key={col.key}
                      aria-sort={
                        col.sortable
                          ? currentDir === 'asc'
                            ? 'ascending'
                            : currentDir === 'desc'
                              ? 'descending'
                              : 'none'
                          : undefined
                      }
                      className={`text-left ${headPad} text-[11px] font-bold text-gray-400 uppercase tracking-wider whitespace-nowrap select-none
                      ${col.sortable ? 'cursor-pointer hover:bg-gray-50 hover:text-[#F28C38] transition-colors' : ''}
                      ${col.headerClass ?? ''}`}
                      onClick={col.sortable ? () => toggleSort(col.key) : undefined}
                      {...(col.sortable
                        ? {
                            role: 'button' as const,
                            tabIndex: 0,
                            onKeyDown: (e: React.KeyboardEvent) => {
                              if (e.key === 'Enter' || e.key === ' ') {
                                e.preventDefault()
                                toggleSort(col.key)
                              }
                            },
                          }
                        : {})}
                    >
                      <span className="inline-flex items-center gap-1.5">
                        {col.label}
                        {col.sortable && <SortIndicator dir={currentDir} />}
                      </span>
                    </th>
                  )
                })}
                {hasActions && (
                  <th
                    className={`${headPad} text-right text-[11px] font-bold text-gray-400 uppercase tracking-wider`}
                  >
                    Actions
                  </th>
                )}
              </tr>
            </thead>

            <tbody
              className={`divide-y divide-gray-50 transition-opacity duration-200 ${loading ? 'opacity-40 pointer-events-none' : 'opacity-100'}`}
            >
              {paginated.map((row) => (
                <tr
                  key={rowKey(row)}
                  onClick={onRowClick ? () => onRowClick(row) : undefined}
                  className={`group transition-colors duration-100
                    ${
                      onRowClick
                        ? 'cursor-pointer hover:bg-[#F28C38]/[0.04] active:bg-[#F28C38]/10'
                        : 'hover:bg-gray-50/70'
                    }`}
                >
                  {columns.map((col) => (
                    <td key={col.key} className={`${cellPad} ${col.className ?? ''}`}>
                      {col.render
                        ? col.render(row)
                        : String((row as Record<string, unknown>)[col.key] ?? '') || (
                            <span className="text-gray-300">—</span>
                          )}
                    </td>
                  ))}
                  {hasActions && (
                    <td className={`${cellPad} text-right`}>
                      <div className="flex items-center justify-end gap-2">{actions!(row)}</div>
                    </td>
                  )}
                </tr>
              ))}

              {paginated.length === 0 && (
                <tr>
                  <td
                    colSpan={columns.length + (hasActions ? 1 : 0)}
                    className="px-4 py-12 text-center"
                  >
                    {loading ? (
                      <span className="inline-flex items-center gap-2 text-gray-400 text-sm">
                        <span className="w-4 h-4 border-2 border-[#F28C38] border-t-transparent rounded-full animate-spin" />
                        Chargement…
                      </span>
                    ) : (
                      <span className="text-gray-400 text-sm">{emptyMessage}</span>
                    )}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Footer */}
        {sorted.length > 0 && (
          <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 px-4 py-2.5 border-t border-gray-50 bg-gray-50/40">
            {/* Left */}
            <div className="flex items-center gap-3 text-xs text-gray-400 flex-wrap">
              <span>
                <span className="font-semibold text-gray-600">
                  {from}–{to}
                </span>{' '}
                sur <span className="font-semibold text-gray-600">{sorted.length}</span> résultat
                {sorted.length > 1 ? 's' : ''}
                {search && data.length !== sorted.length && (
                  <span className="ml-1 text-gray-300">(sur {data.length} total)</span>
                )}
              </span>

              <span className="text-gray-200 hidden sm:inline">|</span>

              <span className="hidden sm:flex items-center gap-1.5">
                <span className="text-gray-400">Lignes :</span>
                {pageSizes.map((s) => (
                  <button
                    key={s}
                    onClick={() => {
                      setPageSize(s)
                      goToPage(1)
                    }}
                    className={`min-w-[28px] px-1.5 py-0.5 rounded text-xs font-medium transition-colors ${
                      pageSize === s
                        ? 'bg-[#F28C38] text-white'
                        : 'text-gray-400 hover:text-gray-700 hover:bg-gray-100'
                    }`}
                  >
                    {s}
                  </button>
                ))}
              </span>
            </div>

            {/* Right — page numbers */}
            {totalPages > 1 && (
              <nav className="flex items-center gap-0.5" aria-label="Pagination">
                <NavBtn
                  label="«"
                  title="Première page"
                  onClick={() => goToPage(1)}
                  disabled={safePage <= 1}
                />
                <NavBtn
                  label="‹"
                  title="Page précédente"
                  onClick={() => goToPage(Math.max(1, safePage - 1))}
                  disabled={safePage <= 1}
                />

                {buildPages(totalPages, safePage).map((p, i) =>
                  p === '…' ? (
                    <span
                      key={`e${i}`}
                      className="w-8 text-center text-xs text-gray-300 select-none"
                    >
                      …
                    </span>
                  ) : (
                    <NavBtn
                      key={p}
                      label={String(p)}
                      onClick={() => goToPage(p as number)}
                      active={p === safePage}
                    />
                  )
                )}

                <NavBtn
                  label="›"
                  title="Page suivante"
                  onClick={() => goToPage(Math.min(totalPages, safePage + 1))}
                  disabled={safePage >= totalPages}
                />
                <NavBtn
                  label="»"
                  title="Dernière page"
                  onClick={() => goToPage(totalPages)}
                  disabled={safePage >= totalPages}
                />
              </nav>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function SortIndicator({ dir }: { dir: 'asc' | 'desc' | null }) {
  if (dir === 'asc') return <span className="text-[#F28C38] text-[9px]">▲</span>
  if (dir === 'desc') return <span className="text-[#F28C38] text-[9px]">▼</span>
  return <span className="text-gray-200 text-[9px]">⬍</span>
}

function NavBtn({
  label,
  title,
  onClick,
  disabled = false,
  active = false,
}: {
  label: string
  title?: string
  onClick: () => void
  disabled?: boolean
  active?: boolean
}) {
  return (
    <button
      title={title}
      onClick={onClick}
      disabled={disabled}
      className={`min-w-[30px] h-7 px-1.5 rounded-lg text-xs font-medium transition-all select-none ${
        active
          ? 'bg-[#F28C38] text-white shadow-sm'
          : disabled
            ? 'text-gray-200 cursor-not-allowed'
            : 'text-gray-500 hover:bg-[#F28C38]/10 hover:text-[#F28C38]'
      }`}
    >
      {label}
    </button>
  )
}

// ---------------------------------------------------------------------------
// ServerPagination — pour les tableaux paginés côté serveur (ex. Pilotage)
// ---------------------------------------------------------------------------

interface ServerPaginationProps {
  page: number
  totalPages: number
  total: number
  pageSize: number
  loading?: boolean
  onPageChange: (page: number) => void
  onPageSizeChange?: (size: number) => void
  pageSizes?: number[]
  label?: string
}

export function ServerPagination({
  page,
  totalPages,
  total,
  pageSize,
  loading = false,
  onPageChange,
  onPageSizeChange,
  pageSizes = [10, 25, 50],
  label = 'résultats',
}: ServerPaginationProps) {
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1
  const to = Math.min(page * pageSize, total)
  const pages = buildPages(totalPages, page)

  return (
    <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 pt-3 border-t border-gray-50">
      {/* Left */}
      <div className="flex items-center gap-3 text-xs text-gray-400 flex-wrap">
        <span className={`transition-opacity ${loading ? 'opacity-40' : ''}`}>
          <span className="font-semibold text-gray-600">
            {from}–{to}
          </span>{' '}
          sur <span className="font-semibold text-gray-600">{total}</span> {label}
        </span>

        {onPageSizeChange && (
          <>
            <span className="text-gray-200">|</span>
            <span className="flex items-center gap-1.5">
              <span>Lignes :</span>
              {pageSizes.map((s) => (
                <button
                  key={s}
                  onClick={() => onPageSizeChange(s)}
                  className={`min-w-[28px] px-1.5 py-0.5 rounded text-xs font-medium transition-colors ${
                    pageSize === s
                      ? 'bg-[#F28C38] text-white'
                      : 'text-gray-400 hover:text-gray-700 hover:bg-gray-100'
                  }`}
                >
                  {s}
                </button>
              ))}
            </span>
          </>
        )}
      </div>

      {/* Right */}
      {totalPages > 1 && (
        <nav className="flex items-center gap-0.5">
          <NavBtn label="«" onClick={() => onPageChange(1)} disabled={page <= 1 || loading} />
          <NavBtn
            label="‹"
            onClick={() => onPageChange(page - 1)}
            disabled={page <= 1 || loading}
          />
          {pages.map((p, i) =>
            p === '…' ? (
              <span key={`e${i}`} className="w-8 text-center text-xs text-gray-300">
                …
              </span>
            ) : (
              <NavBtn
                key={p}
                label={String(p)}
                onClick={() => onPageChange(p)}
                active={p === page}
                disabled={loading}
              />
            )
          )}
          <NavBtn
            label="›"
            onClick={() => onPageChange(page + 1)}
            disabled={page >= totalPages || loading}
          />
          <NavBtn
            label="»"
            onClick={() => onPageChange(totalPages)}
            disabled={page >= totalPages || loading}
          />
        </nav>
      )}
    </div>
  )
}
