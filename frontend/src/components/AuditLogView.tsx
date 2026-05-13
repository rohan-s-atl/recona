'use client'

import { useState, useMemo } from 'react'
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

function formatAction(action: string): string {
  return ACTION_LABEL[action] ?? action.replace(/_/g, ' ')
}

function formatMetadata(meta: Record<string, unknown> | null): string {
  if (!meta) return '-'
  const parts: string[] = []
  if (meta.discrepancy_count != null) parts.push(`${meta.discrepancy_count} discrepancies`)
  if (meta.total_amount_at_risk != null)
    parts.push(`$${Number(meta.total_amount_at_risk).toFixed(2)} at risk`)
  return parts.length > 0 ? parts.join(' - ') : JSON.stringify(meta)
}

interface AuditLogViewProps {
  entries: AuditLogEntry[]
}

export function AuditLogView({ entries }: AuditLogViewProps) {
  const [actionFilter, setActionFilter] = useState<string>('all')
  const [userFilter, setUserFilter] = useState('')
  const [fromDate, setFromDate] = useState('')
  const [toDate, setToDate] = useState('')

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
      {/* Filters */}
      <div className="glass rounded-2xl p-4 flex flex-wrap items-end gap-3">
        <div className="flex flex-col gap-1">
          <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Action</label>
          <select
            value={actionFilter}
            onChange={(e) => setActionFilter(e.target.value)}
            className="text-sm bg-white/60 backdrop-blur-sm border border-white/60 rounded-lg px-3 py-1.5 text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500/40"
          >
            {uniqueActions.map((a) => (
              <option key={a} value={a}>
                {a === 'all' ? 'All actions' : formatAction(a)}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">User ID</label>
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
            <input
              type="text"
              placeholder="Filter by user..."
              value={userFilter}
              onChange={(e) => setUserFilter(e.target.value)}
              className="text-sm pl-8 pr-3 py-1.5 bg-white/60 backdrop-blur-sm border border-white/60 rounded-lg text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500/40 w-52"
            />
          </div>
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">From</label>
          <input
            type="date"
            value={fromDate}
            onChange={(e) => setFromDate(e.target.value)}
            className="text-sm bg-white/60 backdrop-blur-sm border border-white/60 rounded-lg px-3 py-1.5 text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500/40"
          />
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">To</label>
          <input
            type="date"
            value={toDate}
            onChange={(e) => setToDate(e.target.value)}
            className="text-sm bg-white/60 backdrop-blur-sm border border-white/60 rounded-lg px-3 py-1.5 text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500/40"
          />
        </div>

        <div className="ml-auto flex items-center gap-2">
          <span className="text-xs text-gray-400">{filtered.length} entries</span>
          <button
            onClick={handleExport}
            disabled={filtered.length === 0}
            className="flex items-center gap-1.5 text-xs font-semibold text-gray-600 glass px-3 py-1.5 rounded-lg hover:bg-white/70 transition-colors disabled:opacity-40"
          >
            <Download className="w-3.5 h-3.5" />
            Export CSV
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="glass rounded-2xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-white/60">
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">
                Timestamp
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">
                Action
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">
                User
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">
                Run
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">
                Details
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/50">
            {filtered.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-12 text-center text-gray-400 text-sm">
                  No audit log entries match the current filters
                </td>
              </tr>
            )}
            {filtered.map((entry) => {
              const date = new Date(entry.created_at)
              return (
                <tr key={entry.id} className="hover:bg-white/30 transition-colors">
                  <td className="px-4 py-3 text-xs text-gray-500 font-mono whitespace-nowrap">
                    <p>{date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</p>
                    <p className="text-gray-400">{date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', second: '2-digit' })}</p>
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={cn(
                        'text-xs font-semibold px-2 py-0.5 rounded-full',
                        entry.action === 'reconciliation_run_created'
                          ? 'bg-blue-100/80 text-blue-700'
                          : 'bg-gray-100/80 text-gray-600'
                      )}
                    >
                      {formatAction(entry.action)}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-500 font-mono">
                    {entry.user_id ? (
                      <span title={entry.user_id}>{entry.user_id.slice(0, 14)}...</span>
                    ) : (
                      <span className="text-gray-300">-</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-xs">
                    {entry.run_id ? (
                      <a
                        href={`/runs/${entry.run_id}`}
                        className="font-mono text-blue-600 hover:underline"
                      >
                        {entry.run_id.slice(0, 8)}...
                      </a>
                    ) : (
                      <span className="text-gray-300">-</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-500">
                    {formatMetadata(entry.metadata)}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
