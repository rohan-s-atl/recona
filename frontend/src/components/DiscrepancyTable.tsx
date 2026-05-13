'use client'

import { Fragment, useState } from 'react'
import { Discrepancy, DiscrepancyType } from '@/types'
import { formatCurrency, exportToCsv, cn } from '@/lib/utils'
import { ChevronDown, ChevronRight, Download } from 'lucide-react'

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

  const filtered =
    filter === 'all' ? discrepancies : discrepancies.filter((d) => d.type === filter)

  function toggle(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
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
        ai_reason: d.aiReason ?? '',
      }))
    )
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
              onClick={() => setFilter(value)}
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
      <button
        onClick={handleExport}
        disabled={filtered.length === 0}
        className="flex items-center gap-1.5 text-xs font-semibold text-gray-500 hover:text-gray-800 glass px-3 py-1.5 rounded-lg hover:bg-white/70 transition-colors disabled:opacity-40 print:hidden"
      >
        <Download className="w-3.5 h-3.5" />
        Export CSV
      </button>
      </div>

      <div className="glass rounded-2xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-white/60">
              <th className="w-8" />
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Type</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Merchant</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Product</th>
              <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wide">At Risk</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Severity</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Summary</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/50">
            {filtered.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-12 text-center text-gray-400 text-sm">
                  No discrepancies in this category
                </td>
              </tr>
            )}
            {filtered.map((d) => {
              const isOpen = expanded.has(d.id)
              return (
                <Fragment key={d.id}>
                  <tr
                    className="hover:bg-white/40 cursor-pointer transition-colors"
                    onClick={() => toggle(d.id)}
                  >
                    <td className="pl-3 py-3.5 text-gray-400">
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
                    <td className="px-4 py-3.5 text-gray-400 text-xs max-w-xs truncate">{d.aiReason}</td>
                  </tr>

                  {isOpen && (
                    <tr>
                      <td colSpan={7} className="bg-white/30 backdrop-blur-sm px-6 py-5 border-b border-white/50">
                        <div className="space-y-4 text-xs">
                          <div>
                            <p className="font-semibold text-gray-700 mb-1">AI Analysis</p>
                            <p className="text-gray-600 leading-relaxed">{d.aiReason}</p>
                          </div>
                          <div>
                            <p className="font-semibold text-gray-700 mb-1">Root Cause</p>
                            <p className="text-gray-500 italic">{d.rootCause}</p>
                          </div>
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
  )
}
