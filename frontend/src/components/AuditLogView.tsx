'use client'

import { useMemo, useState } from 'react'
import { Download, Search } from 'lucide-react'
import { exportToCsv, cn } from '@/lib/utils'
import type { AuditLogEntry } from '@/lib/db'

const ACTION_LABEL: Record<string, string> = {
  file_uploaded: 'File uploaded',
  fee_schedule_uploaded: 'Fee schedule uploaded',
  teammate_invited: 'Teammate invited',
  reconciliation_run_created: 'Run created',
  export_downloaded: 'Export downloaded',
  run_viewed: 'Run viewed',
}

const ACTION_STYLE: Record<string, string> = {
  file_uploaded: 'bg-blue-100/80 text-blue-700',
  fee_schedule_uploaded: 'bg-emerald-100/80 text-emerald-700',
  teammate_invited: 'bg-violet-100/80 text-violet-700',
  reconciliation_run_created: 'bg-indigo-100/80 text-indigo-700',
  export_downloaded: 'bg-amber-100/80 text-amber-700',
  run_viewed: 'bg-gray-100/80 text-gray-600',
}

function formatAction(action: string): string {
  return ACTION_LABEL[action] ?? action.replace(/_/g, ' ')
}

function formatMetadata(meta: Record<string, unknown> | null): string {
  if (!meta) return '-'

  const filename = stringValue(meta.filename)
  const role = stringValue(meta.role)
  const rowCount = numberValue(meta.row_count ?? meta.record_count)
  const sizeBytes = numberValue(meta.size_bytes)
  const columnCount = numberValue(meta.column_count)
  const productCount = numberValue(meta.product_count)
  const merchantCount = numberValue(meta.merchant_count)
  const discrepancyCount = numberValue(meta.discrepancy_count)
  const totalAtRisk = numberValue(meta.total_amount_at_risk)

  if (discrepancyCount != null || totalAtRisk != null) {
    return [
      discrepancyCount != null ? `${discrepancyCount.toLocaleString()} discrepancies` : null,
      totalAtRisk != null ? `$${totalAtRisk.toLocaleString(undefined, { maximumFractionDigits: 2 })} at risk` : null,
    ]
      .filter(Boolean)
      .join(' - ')
  }

  if (filename) {
    return [
      role ? `${role} file` : 'file',
      filename,
      rowCount != null ? `${rowCount.toLocaleString()} rows` : null,
      columnCount != null ? `${columnCount} columns` : null,
      sizeBytes != null ? `${Math.round(sizeBytes / 1024).toLocaleString()} KB` : null,
    ]
      .filter(Boolean)
      .join(' - ')
  }

  if (productCount != null || merchantCount != null) {
    return [
      merchantCount != null ? `${merchantCount.toLocaleString()} merchants` : null,
      productCount != null ? `${productCount.toLocaleString()} products` : null,
      rowCount != null ? `${rowCount.toLocaleString()} records` : null,
    ]
      .filter(Boolean)
      .join(' - ')
  }

  return Object.entries(meta)
    .slice(0, 4)
    .map(([key, value]) => `${key}: ${String(value)}`)
    .join(' - ')
}

function stringValue(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value : null
}

function numberValue(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string' && value.trim() && Number.isFinite(Number(value))) return Number(value)
  return null
}

interface AuditLogViewProps {
  entries: AuditLogEntry[]
}

export function AuditLogView({ entries }: AuditLogViewProps) {
  const [actionFilter, setActionFilter] = useState<string>('all')
  const [userFilter, setUserFilter] = useState('')
  const [fromDate, setFromDate] = useState('')
  const [toDate, setToDate] = useState('')
  const [pageSize, setPageSize] = useState(50)
  const [page, setPage] = useState(1)

  const uniqueActions = useMemo(() => {
    const s = new Set(entries.map((e) => e.action))
    return ['all', ...Array.from(s).sort()]
  }, [entries])

  const filtered = useMemo(() => {
    return entries.filter((e) => {
      if (actionFilter !== 'all' && e.action !== actionFilter) return false
      if (userFilter && !(e.user_id ?? '').toLowerCase().includes(userFilter.toLowerCase())) return false
      if (fromDate && e.created_at < fromDate) return false
      if (toDate && e.created_at > toDate + 'T23:59:59Z') return false
      return true
    })
  }, [entries, actionFilter, userFilter, fromDate, toDate])

  const totalPages = Math.max(Math.ceil(filtered.length / pageSize), 1)
  const safePage = Math.min(page, totalPages)
  const start = (safePage - 1) * pageSize
  const visible = filtered.slice(start, start + pageSize)

  function resetPaging() {
    setPage(1)
  }

  function handleExport() {
    exportToCsv(
      `audit-log-${new Date().toISOString().slice(0, 10)}.csv`,
      filtered.map((e) => ({
        timestamp: e.created_at,
        action: e.action,
        user_id: e.user_id ?? '',
        run_id: e.run_id ?? '',
        discrepancy_id: e.discrepancy_id ?? '',
        ip_address: e.ip_address ?? '',
        metadata: e.metadata ? JSON.stringify(e.metadata) : '',
      }))
    )
  }

  return (
    <div className="space-y-4">
      <div className="glass rounded-xl p-4">
        <div className="grid gap-3 xl:grid-cols-[220px_minmax(260px,1fr)_170px_170px_auto] xl:items-end">
          <label className="flex flex-col gap-1">
            <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">Action</span>
            <select
              value={actionFilter}
              onChange={(e) => {
                setActionFilter(e.target.value)
                resetPaging()
              }}
              className="h-10 rounded-lg border border-white/60 bg-white/70 px-3 text-[15px] text-gray-700 outline-none focus:ring-2 focus:ring-blue-500/40"
            >
              {uniqueActions.map((a) => (
                <option key={a} value={a}>
                  {a === 'all' ? 'All actions' : formatAction(a)}
                </option>
              ))}
            </select>
          </label>

          <label className="flex flex-col gap-1">
            <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">User ID</span>
            <span className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Filter by user..."
                value={userFilter}
                onChange={(e) => {
                  setUserFilter(e.target.value)
                  resetPaging()
                }}
                className="h-10 w-full rounded-lg border border-white/60 bg-white/70 pl-9 pr-3 text-[15px] text-gray-700 outline-none focus:ring-2 focus:ring-blue-500/40"
              />
            </span>
          </label>

          <label className="flex flex-col gap-1">
            <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">From</span>
            <input
              type="date"
              value={fromDate}
              onChange={(e) => {
                setFromDate(e.target.value)
                resetPaging()
              }}
              className="h-10 rounded-lg border border-white/60 bg-white/70 px-3 text-[15px] text-gray-700 outline-none focus:ring-2 focus:ring-blue-500/40"
            />
          </label>

          <label className="flex flex-col gap-1">
            <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">To</span>
            <input
              type="date"
              value={toDate}
              onChange={(e) => {
                setToDate(e.target.value)
                resetPaging()
              }}
              className="h-10 rounded-lg border border-white/60 bg-white/70 px-3 text-[15px] text-gray-700 outline-none focus:ring-2 focus:ring-blue-500/40"
            />
          </label>

          <div className="flex items-center justify-end gap-3">
            <span className="whitespace-nowrap text-sm text-gray-400">{filtered.length.toLocaleString()} entries</span>
            <button
              onClick={handleExport}
              disabled={filtered.length === 0}
              className="flex h-10 items-center gap-1.5 whitespace-nowrap rounded-lg bg-white/70 px-3 text-sm font-semibold text-gray-600 transition-colors hover:bg-white disabled:opacity-40"
            >
              <Download className="h-4 w-4" />
              Export CSV
            </button>
          </div>
        </div>
      </div>

      <div className="glass overflow-hidden rounded-xl">
        <div className="flex items-center justify-between border-b border-white/60 px-4 py-3">
          <p className="text-sm font-semibold text-gray-800">
            Showing {filtered.length === 0 ? 0 : start + 1}-{Math.min(start + pageSize, filtered.length)} of{' '}
            {filtered.length.toLocaleString()}
          </p>
          <PaginationControls
            page={safePage}
            totalPages={totalPages}
            pageSize={pageSize}
            onPage={setPage}
            onPageSize={(value) => {
              setPageSize(value)
              setPage(1)
            }}
          />
        </div>

        <div className="overflow-x-auto">
          <table className="w-full table-fixed text-[15px]">
            <colgroup>
              <col className="w-[170px]" />
              <col className="w-[190px]" />
              <col className="w-[190px]" />
              <col className="w-[150px]" />
              <col />
            </colgroup>
            <thead>
              <tr className="border-b border-white/60">
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                  Timestamp
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                  Action
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                  User
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                  Run
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                  Details
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/50">
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-12 text-center text-sm text-gray-400">
                    No audit log entries match the current filters
                  </td>
                </tr>
              )}
              {visible.map((entry) => {
                const date = new Date(entry.created_at)
                const metadata = formatMetadata(entry.metadata)
                return (
                  <tr key={entry.id} className="align-top transition-colors hover:bg-white/30">
                    <td className="px-4 py-3 text-xs font-mono text-gray-500">
                      <p>{date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</p>
                      <p className="text-gray-400">
                        {date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', second: '2-digit' })}
                      </p>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={cn(
                          'inline-flex rounded-full px-2.5 py-1 text-xs font-semibold',
                          ACTION_STYLE[entry.action] ?? 'bg-gray-100/80 text-gray-600'
                        )}
                      >
                        {formatAction(entry.action)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs font-mono text-gray-500">
                      {entry.user_id ? (
                        <span title={entry.user_id} className="block truncate">
                          {entry.user_id}
                        </span>
                      ) : (
                        <span className="text-gray-300">-</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs">
                      {entry.run_id ? (
                        <a href={`/runs/${entry.run_id}`} className="block truncate font-mono text-blue-600 hover:underline">
                          {entry.run_id}
                        </a>
                      ) : (
                        <span className="text-gray-300">-</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm leading-relaxed text-gray-600">
                      <span title={entry.metadata ? JSON.stringify(entry.metadata) : undefined} className="line-clamp-2">
                        {metadata}
                      </span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

function PaginationControls({
  page,
  totalPages,
  pageSize,
  onPage,
  onPageSize,
}: {
  page: number
  totalPages: number
  pageSize: number
  onPage: (page: number) => void
  onPageSize: (pageSize: number) => void
}) {
  return (
    <div className="flex items-center gap-2 text-xs">
      <span className="text-gray-400">Rows</span>
      <select
        value={pageSize}
        onChange={(event) => onPageSize(Number(event.target.value))}
        className="rounded-lg border border-white/70 bg-white/70 px-2 py-1 font-semibold text-gray-700 outline-none"
      >
        {[10, 50, 100].map((value) => (
          <option key={value} value={value}>
            {value}
          </option>
        ))}
      </select>
      <button
        onClick={() => onPage(Math.max(page - 1, 1))}
        disabled={page <= 1}
        className="rounded-lg bg-white/70 px-2.5 py-1 font-semibold text-gray-600 disabled:opacity-40"
      >
        Prev
      </button>
      <span className="min-w-[70px] text-center font-semibold text-gray-600">
        {page} / {totalPages}
      </span>
      <button
        onClick={() => onPage(Math.min(page + 1, totalPages))}
        disabled={page >= totalPages}
        className="rounded-lg bg-white/70 px-2.5 py-1 font-semibold text-gray-600 disabled:opacity-40"
      >
        Next
      </button>
    </div>
  )
}
