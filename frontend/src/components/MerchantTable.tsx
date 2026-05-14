'use client'

import { Fragment, useState } from 'react'
import { MerchantSummary } from '@/types'
import { formatCurrency, cn } from '@/lib/utils'
import { ChevronDown, ChevronRight } from 'lucide-react'

const TYPE_BADGE: Record<string, string> = {
  missing_from_billing:   'bg-orange-100/80 text-orange-700',
  missing_from_charges:   'bg-red-100/80 text-red-700',
  rate_mismatch:          'bg-purple-100/80 text-purple-700',
  plan_mismatch:          'bg-blue-100/80 text-blue-700',
  amount_mismatch:        'bg-amber-100/80 text-amber-700',
  missing_contracted_fee: 'bg-rose-100/80 text-rose-700',
  closed_account_billed:  'bg-gray-100/80 text-gray-700',
  proration_error:        'bg-cyan-100/80 text-cyan-700',
  duplicate_invoice:      'bg-yellow-100/80 text-yellow-700',
}

const TYPE_LABEL: Record<string, string> = {
  missing_from_billing:   'Missing from billing',
  missing_from_charges:   'Phantom billing',
  rate_mismatch:          'Rate mismatch',
  plan_mismatch:          'Plan mismatch',
  amount_mismatch:        'Amount mismatch',
  missing_contracted_fee: 'Contract not billed',
  closed_account_billed:  'Closed acct billed',
  proration_error:        'Pro-ration error',
  duplicate_invoice:      'Duplicate invoice',
}

const SEVERITY_DOT: Record<string, string> = {
  critical: 'bg-red-500',
  high:     'bg-orange-500',
  medium:   'bg-amber-400',
  low:      'bg-gray-300',
}

interface MerchantTableProps {
  summaries: MerchantSummary[]
}

export function MerchantTable({ summaries }: MerchantTableProps) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [pageSize, setPageSize] = useState(50)
  const [page, setPage] = useState(1)
  const totalPages = Math.max(Math.ceil(summaries.length / pageSize), 1)
  const safePage = Math.min(page, totalPages)
  const start = (safePage - 1) * pageSize
  const visibleSummaries = summaries.slice(start, start + pageSize)

  function toggle(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  return (
    <div className="glass overflow-hidden rounded-xl">
      <div className="flex items-center justify-between gap-3 border-b border-white/60 px-4 py-3 print:hidden">
        <p className="text-sm font-semibold text-gray-800">
          Showing {summaries.length === 0 ? 0 : start + 1}-{Math.min(start + pageSize, summaries.length)} of{' '}
          {summaries.length.toLocaleString()} merchants
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
        <table className="w-full text-[15px]">
          <thead>
            <tr className="border-b border-white/60">
              <th className="w-8" />
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Merchant</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">MID</th>
              <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wide">Charged</th>
              <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wide">Billed</th>
              <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wide">At Risk</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Issues</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/50">
            {visibleSummaries.map((m) => {
            const isOpen = expanded.has(m.merchantId)
            return (
              <Fragment key={m.merchantId}>
                <tr
                  className={cn(
                    'cursor-pointer transition-colors',
                    m.discrepancyCount > 0 ? 'hover:bg-red-500/5' : 'hover:bg-white/40'
                  )}
                  onClick={() => toggle(m.merchantId)}
                >
                  <td className="pl-3 py-3.5 text-gray-400">
                    {isOpen
                      ? <ChevronDown className="w-3.5 h-3.5" />
                      : <ChevronRight className="w-3.5 h-3.5" />}
                  </td>
                  <td className="px-4 py-3.5 font-medium text-gray-900 capitalize">{m.merchantName}</td>
                  <td className="px-4 py-3.5 text-gray-400 font-mono text-xs">{m.merchantId}</td>
                  <td className="px-4 py-3.5 text-right text-gray-600">{formatCurrency(m.totalCharged)}</td>
                  <td className="px-4 py-3.5 text-right text-gray-600">{formatCurrency(m.totalBilled)}</td>
                  <td className="px-4 py-3.5 text-right font-semibold">
                    {m.totalAtRisk > 0
                      ? <span className="text-red-600">{formatCurrency(m.totalAtRisk)}</span>
                      : <span className="text-emerald-600">Clean</span>}
                  </td>
                  <td className="px-4 py-3.5">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {m.discrepancies.slice(0, 3).map((d) => (
                        <span
                          key={d.id}
                          className={cn(
                            'inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium',
                            TYPE_BADGE[d.type] ?? 'bg-gray-100/80 text-gray-600'
                          )}
                        >
                          <span className={cn('w-1.5 h-1.5 rounded-full', SEVERITY_DOT[d.severity])} />
                          {TYPE_LABEL[d.type]}
                        </span>
                      ))}
                      {m.discrepancies.length > 3 && (
                        <span className="text-xs text-gray-400">+{m.discrepancies.length - 3} more</span>
                      )}
                    </div>
                  </td>
                </tr>

                {isOpen && m.discrepancies.length > 0 && (
                  <tr>
                    <td colSpan={7} className="bg-white/30 backdrop-blur-sm px-6 py-4 border-b border-white/50">
                      <div className="space-y-2.5">
                        {m.discrepancies.map((d) => (
                          <div key={d.id} className="bg-white/60 rounded-xl border border-white/80 p-4 text-xs">
                            <div className="flex items-start justify-between gap-4 mb-2">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className={cn('px-2 py-0.5 rounded-full font-semibold', TYPE_BADGE[d.type])}>
                                  {TYPE_LABEL[d.type]}
                                </span>
                                <span className="text-gray-500">{d.productLine}</span>
                                {d.feeScheduleRecord && (
                                  <span className="text-gray-400 italic">
                                    contract: ${d.feeScheduleRecord.contracted_rate}
                                    {d.feeScheduleRecord.rate_type === 'percentage' ? '%' : '/mo'}
                                  </span>
                                )}
                              </div>
                              <span className={cn('font-bold flex-shrink-0', d.direction === 'over_billed' ? 'text-gray-600' : 'text-red-600')}>
                                {d.direction === 'over_billed' ? 'Overbilled ' : 'At risk '}
                                {formatCurrency(d.amountAtRisk)}
                              </span>
                            </div>
                            <p className="text-gray-600 mb-1.5">{d.aiReason}</p>
                            <p className="text-gray-400 italic">Root cause: {d.rootCause}</p>
                          </div>
                        ))}
                      </div>
                    </td>
                  </tr>
                )}

                {isOpen && m.discrepancies.length === 0 && (
                  <tr>
                    <td colSpan={7} className="bg-emerald-500/5 px-6 py-3 text-xs text-emerald-700 border-b border-emerald-100/50">
                      All charges and invoices reconcile cleanly for this merchant.
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
