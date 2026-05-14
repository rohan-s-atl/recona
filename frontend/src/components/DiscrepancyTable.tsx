'use client'

import { Fragment, useState } from 'react'
import { Discrepancy, DiscrepancyStatus, DiscrepancyType, ResolutionType } from '@/types'
import { formatCurrency, exportToCsv, cn } from '@/lib/utils'
import { CheckCircle, ChevronDown, ChevronRight, Download, UserPlus } from 'lucide-react'

const TYPE_LABEL: Record<DiscrepancyType, string> = {
  missing_from_billing:    'Missing from Billing',
  missing_from_charges:    'Phantom / Overbilled',
  rate_mismatch:           'Rate Mismatch',
  plan_mismatch:           'Plan Mismatch',
  amount_mismatch:         'Amount Mismatch',
  missing_contracted_fee:  'Contract Not Billed',
  closed_account_billed:   'Closed Acct Billed',
  proration_error:         'Pro-ration Error',
  duplicate_invoice:       'Duplicate Invoice',
  name_variation_flagged:  'Needs Review',
}

const TYPE_STYLE: Record<DiscrepancyType, string> = {
  missing_from_billing:    'bg-orange-100/80 text-orange-700',
  missing_from_charges:    'bg-red-100/80 text-red-700',
  rate_mismatch:           'bg-purple-100/80 text-purple-700',
  plan_mismatch:           'bg-blue-100/80 text-blue-700',
  amount_mismatch:         'bg-amber-100/80 text-amber-700',
  missing_contracted_fee:  'bg-rose-100/80 text-rose-700',
  closed_account_billed:   'bg-gray-100/80 text-gray-600',
  proration_error:         'bg-cyan-100/80 text-cyan-700',
  duplicate_invoice:       'bg-yellow-100/80 text-yellow-700',
  name_variation_flagged:  'bg-gray-100/80 text-gray-500',
}

const SEVERITY_STYLE: Record<string, string> = {
  critical: 'bg-red-100/80 text-red-700',
  high:     'bg-orange-100/80 text-orange-700',
  medium:   'bg-amber-100/80 text-amber-700',
  low:      'bg-gray-100/80 text-gray-500',
}

const STATUS_STYLE: Record<DiscrepancyStatus, string> = {
  open: 'bg-red-100/80 text-red-700',
  in_review: 'bg-blue-100/80 text-blue-700',
  resolved: 'bg-emerald-100/80 text-emerald-700',
}

const ROOT_CAUSE_LABEL: Record<string, string> = {
  provisioning_gap: 'Provisioning gap',
  rate_table_error: 'Rate table error',
  plan_sync_failure: 'Plan sync failure',
  account_lifecycle_failure: 'Account lifecycle failure',
  proration_logic_mismatch: 'Proration logic mismatch',
  manual_override_not_propagated: 'Manual override not propagated',
  data_sync_failure: 'Data sync failure',
  duplicate_record: 'Duplicate record',
  unclassified: 'Unclassified',
}

const FILTERS: { value: DiscrepancyType | 'all'; label: string }[] = [
  { value: 'all',                    label: 'All' },
  { value: 'rate_mismatch',          label: 'Rate Mismatch' },
  { value: 'plan_mismatch',          label: 'Plan Mismatch' },
  { value: 'missing_from_billing',   label: 'Missing Invoice' },
  { value: 'missing_contracted_fee', label: 'Contract Not Billed' },
  { value: 'missing_from_charges',   label: 'Phantom Billing' },
  { value: 'closed_account_billed',  label: 'Closed Acct' },
]

interface DiscrepancyTableProps {
  discrepancies: Discrepancy[]
}

export function DiscrepancyTable({ discrepancies }: DiscrepancyTableProps) {
  const [filter, setFilter] = useState<DiscrepancyType | 'all'>('all')
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [pageSize, setPageSize] = useState(50)
  const [page, setPage] = useState(1)
  const [assignedTo, setAssignedTo] = useState('')
  const [assignmentNote, setAssignmentNote] = useState('')
  const [dueAt, setDueAt] = useState('')
  const [resolutionType, setResolutionType] = useState<ResolutionType>('corrected')
  const [resolutionComment, setResolutionComment] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const filtered =
    filter === 'all' ? discrepancies : discrepancies.filter((d) => d.type === filter)
  const totalPages = Math.max(Math.ceil(filtered.length / pageSize), 1)
  const safePage = Math.min(page, totalPages)
  const start = (safePage - 1) * pageSize
  const visible = filtered.slice(start, start + pageSize)

  function toggle(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  function toggleSelected(id: string) {
    setSelected((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  function toggleVisibleSelected() {
    setSelected((prev) => {
      const next = new Set(prev)
      const allVisibleSelected = visible.every((d) => next.has(d.id))
      for (const discrepancy of visible) {
        allVisibleSelected ? next.delete(discrepancy.id) : next.add(discrepancy.id)
      }
      return next
    })
  }

  const activeTypes = new Set(discrepancies.map((d) => d.type))

  function handleExport() {
    exportToCsv(
      `discrepancies-${new Date().toISOString().slice(0, 10)}.csv`,
      filtered.map((d) => ({
        type: TYPE_LABEL[d.type],
        merchant: d.merchantName,
        merchant_id: d.merchantId,
        product_line: d.productLine ?? '',
        amount_at_risk: d.amountAtRisk,
        direction: d.direction,
        severity: d.severity,
        status: d.status ?? 'open',
        assigned_to: d.assignedTo ?? '',
        due_at: d.dueAt ?? '',
        resolution_type: d.resolutionType ?? '',
        resolution_comment: d.resolutionComment ?? '',
        root_cause_category: d.rootCauseCategory ?? 'unclassified',
        ai_reason: d.aiReason ?? '',
      }))
    )
  }

  async function applyWorkflow(action: 'assign' | 'review' | 'resolve') {
    setBusy(true)
    setError(null)
    try {
      const body =
        action === 'assign'
          ? {
              ids: [...selected],
              assignedTo,
              assignmentNote,
              dueAt: dueAt || null,
              status: 'in_review',
            }
          : action === 'review'
            ? { ids: [...selected], status: 'in_review' }
            : {
                ids: [...selected],
                status: 'resolved',
                resolutionType,
                resolutionComment,
              }
      const response = await fetch('/api/discrepancies/workflow', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const json = await response.json()
      if (!response.ok) throw new Error(json.error ?? 'Workflow update failed')
      window.location.reload()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Workflow update failed')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2 flex-wrap">
      <div className="flex items-center gap-1.5 flex-wrap">
        {FILTERS.filter(
          (f) => f.value === 'all' || activeTypes.has(f.value as DiscrepancyType)
        ).map(({ value, label }) => {
          const count =
            value === 'all'
              ? discrepancies.length
              : discrepancies.filter((d) => d.type === value).length
          return (
            <button
              key={value}
              onClick={() => {
                setFilter(value)
                setPage(1)
                setExpanded(new Set())
              }}
              className={cn(
                'px-3 py-1 text-xs font-semibold rounded-full transition-all',
                filter === value
                  ? 'bg-blue-600 text-white shadow-sm shadow-blue-500/25'
                  : 'bg-white/60 backdrop-blur-sm text-gray-600 hover:bg-white/80 border border-white/70'
              )}
            >
              {label} <span className="opacity-60">({count})</span>
            </button>
          )
        })}
      </div>
      <div className="flex items-center gap-2">
        <PaginationControls
          page={safePage}
          totalPages={totalPages}
          pageSize={pageSize}
          onPage={(nextPage) => {
            setPage(nextPage)
            setExpanded(new Set())
          }}
          onPageSize={(value) => {
            setPageSize(value)
            setPage(1)
            setExpanded(new Set())
          }}
        />
        <button
          onClick={handleExport}
          disabled={filtered.length === 0}
          className="flex items-center gap-1.5 text-xs font-semibold text-gray-500 hover:text-gray-800 glass px-3 py-1.5 rounded-lg hover:bg-white/70 transition-colors disabled:opacity-40 print:hidden"
        >
          <Download className="w-3.5 h-3.5" />
          Export CSV
        </button>
      </div>
      </div>

      {selected.size > 0 && (
        <div className="glass rounded-xl p-4 print:hidden">
          <div className="flex flex-wrap items-end gap-3">
            <div className="mr-auto">
              <p className="text-sm font-semibold text-gray-900">{selected.size} selected</p>
              <p className="text-xs text-gray-400">Assign, move to review, or close with an audit-logged comment.</p>
            </div>
            <label className="min-w-[220px] text-xs font-semibold text-gray-500">
              Owner
              <input
                value={assignedTo}
                onChange={(event) => setAssignedTo(event.target.value)}
                placeholder="name or email"
                className="mt-1 w-full rounded-lg border border-white/70 bg-white/70 px-3 py-2 text-sm font-medium text-gray-800 outline-none"
              />
            </label>
            <label className="min-w-[220px] text-xs font-semibold text-gray-500">
              Note
              <input
                value={assignmentNote}
                onChange={(event) => setAssignmentNote(event.target.value)}
                placeholder="handoff note"
                className="mt-1 w-full rounded-lg border border-white/70 bg-white/70 px-3 py-2 text-sm font-medium text-gray-800 outline-none"
              />
            </label>
            <label className="text-xs font-semibold text-gray-500">
              Due
              <input
                type="date"
                value={dueAt}
                onChange={(event) => setDueAt(event.target.value)}
                className="mt-1 rounded-lg border border-white/70 bg-white/70 px-3 py-2 text-sm font-medium text-gray-800 outline-none"
              />
            </label>
            <button
              onClick={() => applyWorkflow('assign')}
              disabled={busy || !assignedTo.trim()}
              className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-2 text-xs font-semibold text-white shadow-sm shadow-blue-500/20 disabled:opacity-40"
            >
              <UserPlus className="h-3.5 w-3.5" />
              Assign
            </button>
            <button
              onClick={() => applyWorkflow('review')}
              disabled={busy}
              className="rounded-lg bg-white/70 px-3 py-2 text-xs font-semibold text-gray-700 disabled:opacity-40"
            >
              Mark in review
            </button>
          </div>
          <div className="mt-3 flex flex-wrap items-end gap-3 border-t border-white/60 pt-3">
            <label className="text-xs font-semibold text-gray-500">
              Resolution
              <select
                value={resolutionType}
                onChange={(event) => setResolutionType(event.target.value as ResolutionType)}
                className="mt-1 rounded-lg border border-white/70 bg-white/70 px-3 py-2 text-sm font-medium text-gray-800 outline-none"
              >
                {(['corrected', 'waived', 'duplicate', 'escalated'] as ResolutionType[]).map((value) => (
                  <option key={value} value={value}>
                    {value.replace('_', ' ')}
                  </option>
                ))}
              </select>
            </label>
            <label className="min-w-[360px] flex-1 text-xs font-semibold text-gray-500">
              Close comment
              <input
                value={resolutionComment}
                onChange={(event) => setResolutionComment(event.target.value)}
                placeholder="Required to resolve"
                className="mt-1 w-full rounded-lg border border-white/70 bg-white/70 px-3 py-2 text-sm font-medium text-gray-800 outline-none"
              />
            </label>
            <button
              onClick={() => applyWorkflow('resolve')}
              disabled={busy || !resolutionComment.trim()}
              className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-2 text-xs font-semibold text-white shadow-sm shadow-emerald-500/20 disabled:opacity-40"
            >
              <CheckCircle className="h-3.5 w-3.5" />
              Resolve
            </button>
          </div>
          {error && <p className="mt-3 text-xs font-semibold text-red-600">{error}</p>}
        </div>
      )}

      <div className="glass rounded-xl overflow-hidden">
        <div className="flex items-center justify-between border-b border-white/60 px-4 py-3 text-xs text-gray-400 print:hidden">
          <span>
            Showing {filtered.length === 0 ? 0 : start + 1}-{Math.min(start + pageSize, filtered.length)} of{' '}
            {filtered.length.toLocaleString()} issues
          </span>
          <span>{filter === 'all' ? 'All issue types' : TYPE_LABEL[filter]}</span>
        </div>
        <div className="overflow-x-auto">
        <table className="w-full text-[15px]">
          <thead>
            <tr className="border-b border-white/60">
              <th className="w-8 px-3">
                <input
                  type="checkbox"
                  checked={visible.length > 0 && visible.every((d) => selected.has(d.id))}
                  onChange={toggleVisibleSelected}
                  className="h-4 w-4 rounded border-gray-300"
                />
              </th>
              <th className="w-8" />
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Type</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Merchant</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Product</th>
              <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wide">At Risk</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Severity</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Workflow</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Summary</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/50">
            {filtered.length === 0 && (
              <tr>
                <td colSpan={9} className="px-4 py-12 text-center text-gray-400 text-sm">
                  No discrepancies in this category
                </td>
              </tr>
            )}
            {visible.map((d) => {
              const isOpen = expanded.has(d.id)
              return (
                <Fragment key={d.id}>
                  <tr
                    className="hover:bg-white/40 cursor-pointer transition-colors"
                  >
                    <td className="px-3 py-3.5">
                      <input
                        type="checkbox"
                        checked={selected.has(d.id)}
                        onChange={() => toggleSelected(d.id)}
                        className="h-4 w-4 rounded border-gray-300"
                      />
                    </td>
                    <td className="pl-3 py-3.5 text-gray-400 cursor-pointer" onClick={() => toggle(d.id)}>
                      {isOpen
                        ? <ChevronDown className="w-3.5 h-3.5" />
                        : <ChevronRight className="w-3.5 h-3.5" />}
                    </td>
                    <td className="px-4 py-3.5">
                      <span className={cn('text-xs font-semibold px-2 py-0.5 rounded-full', TYPE_STYLE[d.type])}>
                        {TYPE_LABEL[d.type]}
                      </span>
                    </td>
                    <td className="px-4 py-3.5 text-gray-800 font-medium capitalize">{d.merchantName}</td>
                    <td className="px-4 py-3.5 text-gray-500 text-xs capitalize">{d.productLine || '-'}</td>
                    <td className="px-4 py-3.5 text-right font-semibold text-red-600">
                      {formatCurrency(d.amountAtRisk)}
                    </td>
                    <td className="px-4 py-3.5">
                      <span className={cn('text-xs font-semibold px-2 py-0.5 rounded-full', SEVERITY_STYLE[d.severity])}>
                        {d.severity.toUpperCase()}
                      </span>
                    </td>
                    <td className="px-4 py-3.5">
                      <div className="space-y-1">
                        <span className={cn('text-xs font-semibold px-2 py-0.5 rounded-full', STATUS_STYLE[d.status ?? 'open'])}>
                          {(d.status ?? 'open').replace('_', ' ').toUpperCase()}
                        </span>
                        {d.assignedTo && <p className="text-xs text-gray-500">Owner: {d.assignedTo}</p>}
                        {d.dueAt && <p className="text-xs text-gray-400">Due {new Date(d.dueAt).toLocaleDateString()}</p>}
                      </div>
                    </td>
                    <td className="px-4 py-3.5 text-gray-400 text-xs max-w-xs truncate">{d.aiReason}</td>
                  </tr>

                  {isOpen && (
                    <tr>
                      <td colSpan={9} className="bg-white/30 backdrop-blur-sm px-6 py-5 border-b border-white/50">
                        <div className="space-y-4 text-xs">
                          <div>
                            <p className="font-semibold text-gray-700 mb-1">AI Analysis</p>
                            <p className="text-gray-600 leading-relaxed">{d.aiReason}</p>
                          </div>
                          <div>
                            <p className="font-semibold text-gray-700 mb-1">Root Cause</p>
                            <p className="text-gray-500 italic">{d.rootCause}</p>
                            <p className="mt-1 font-semibold text-blue-600">
                              {ROOT_CAUSE_LABEL[d.rootCauseCategory ?? 'unclassified']}
                            </p>
                          </div>
                          {(d.assignmentNote || d.resolutionComment) && (
                            <div className="grid gap-3 md:grid-cols-2">
                              {d.assignmentNote && (
                                <div className="rounded-xl border border-white/80 bg-white/60 p-3">
                                  <p className="font-semibold text-gray-700 mb-1">Assignment Note</p>
                                  <p className="text-gray-600">{d.assignmentNote}</p>
                                </div>
                              )}
                              {d.resolutionComment && (
                                <div className="rounded-xl border border-white/80 bg-white/60 p-3">
                                  <p className="font-semibold text-gray-700 mb-1">Resolution</p>
                                  <p className="text-gray-600">
                                    {d.resolutionType} - {d.resolutionComment}
                                  </p>
                                </div>
                              )}
                            </div>
                          )}
                          {d.feeScheduleRecord && (
                            <div className="bg-white/60 rounded-xl border border-white/80 p-3">
                              <p className="font-semibold text-gray-700 mb-1">Contracted Rate</p>
                              <p className="text-gray-600">
                                {d.feeScheduleRecord.product_name} -{' '}
                                {d.feeScheduleRecord.rate_type === 'flat'
                                  ? `$${d.feeScheduleRecord.contracted_rate}/mo`
                                  : `${d.feeScheduleRecord.contracted_rate}% of volume`}{' '}
                                - Effective {d.feeScheduleRecord.effective_date}
                              </p>
                            </div>
                          )}
                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <p className="font-semibold text-blue-700 mb-1.5">Charge Record</p>
                              {d.chargesRecord ? (
                                <pre className="text-gray-600 whitespace-pre-wrap font-mono bg-white/60 rounded-xl p-3 border border-white/80 text-xs leading-relaxed">
                                  {JSON.stringify(d.chargesRecord._raw, null, 2)}
                                </pre>
                              ) : (
                                <p className="text-gray-400 italic">No charge record found</p>
                              )}
                            </div>
                            <div>
                              <p className="font-semibold text-violet-700 mb-1.5">Invoice Record</p>
                              {d.invoicesRecord ? (
                                <pre className="text-gray-600 whitespace-pre-wrap font-mono bg-white/60 rounded-xl p-3 border border-white/80 text-xs leading-relaxed">
                                  {JSON.stringify(d.invoicesRecord._raw, null, 2)}
                                </pre>
                              ) : (
                                <p className="text-gray-400 italic">No invoice record found</p>
                              )}
                            </div>
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
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
    <div className="flex items-center gap-2 text-xs print:hidden">
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
