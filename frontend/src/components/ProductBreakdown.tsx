'use client'

import { ProductLineSummary } from '@/types'
import { formatCurrency } from '@/lib/utils'

const PRODUCT_COLORS: Record<string, { text: string; bar: string; glow: string }> = {
  'apex pos':       { text: 'text-blue-700',   bar: 'bg-blue-500',   glow: 'shadow-blue-500/20' },
  'flowpay':        { text: 'text-violet-700', bar: 'bg-violet-500', glow: 'shadow-violet-500/20' },
  'shieldnet':      { text: 'text-emerald-700',bar: 'bg-emerald-500',glow: 'shadow-emerald-500/20' },
  'loyaltyloop':    { text: 'text-pink-700',   bar: 'bg-pink-500',   glow: 'shadow-pink-500/20' },
  'insightiq':      { text: 'text-amber-700',  bar: 'bg-amber-500',  glow: 'shadow-amber-500/20' },
  'webcharge':      { text: 'text-cyan-700',   bar: 'bg-cyan-500',   glow: 'shadow-cyan-500/20' },
  'nexus commerce': { text: 'text-indigo-700', bar: 'bg-indigo-500', glow: 'shadow-indigo-500/20' },
  'clearcore':      { text: 'text-teal-700',   bar: 'bg-teal-500',   glow: 'shadow-teal-500/20' },
}

function colorFor(productLine: string) {
  const key = productLine.toLowerCase()
  for (const [prefix, colors] of Object.entries(PRODUCT_COLORS)) {
    if (key.includes(prefix)) return colors
  }
  return { text: 'text-gray-700', bar: 'bg-gray-400', glow: 'shadow-gray-400/20' }
}

interface ProductBreakdownProps {
  summaries: ProductLineSummary[]
}

export function ProductBreakdown({ summaries }: ProductBreakdownProps) {
  if (summaries.length === 0) return null

  const maxAtRisk = Math.max(...summaries.map((s) => s.totalAtRisk), 1)

  return (
    <div className="space-y-3">
      <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
        Revenue at Risk by Product Line
      </h3>
      <div className="space-y-2">
        {summaries.map((s) => {
          const colors = colorFor(s.productLine)
          const pct = (s.totalAtRisk / maxAtRisk) * 100

          return (
            <div key={s.productLine} className="glass rounded-2xl p-4">
              <div className="flex items-center justify-between mb-2.5">
                <div className="flex items-center gap-2">
                  <span className={`text-sm font-semibold ${colors.text}`}>
                    {s.productLine || 'Unknown'}
                  </span>
                  <span className="text-xs text-gray-400">
                    {s.discrepancyCount} issue{s.discrepancyCount !== 1 ? 's' : ''}
                  </span>
                </div>
                <span className={`text-sm font-bold ${colors.text}`}>
                  {formatCurrency(s.totalAtRisk)}
                </span>
              </div>
              <div className="h-1.5 bg-black/5 rounded-full overflow-hidden">
                <div
                  className={`h-full ${colors.bar} rounded-full transition-all shadow-sm ${colors.glow}`}
                  style={{ width: `${pct}%` }}
                />
              </div>
              {Object.entries(s.types).length > 0 && (
                <div className="flex gap-1.5 mt-2.5 flex-wrap">
                  {Object.entries(s.types).map(([type, count]) => (
                    <span
                      key={type}
                      className="text-xs px-2 py-0.5 bg-white/60 rounded-full text-gray-500 border border-white/70"
                    >
                      {TYPE_SHORT[type] ?? type} ×{count}
                    </span>
                  ))}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

const TYPE_SHORT: Record<string, string> = {
  missing_from_billing:   'Missing invoice',
  missing_from_charges:   'Phantom billing',
  rate_mismatch:          'Wrong rate',
  plan_mismatch:          'Wrong plan',
  amount_mismatch:        'Amount diff',
  missing_contracted_fee: 'Contract not billed',
  closed_account_billed:  'Closed acct billed',
  proration_error:        'Pro-rate error',
  duplicate_invoice:      'Duplicate',
}
