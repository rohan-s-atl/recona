'use client'

import { ReconciliationResult } from '@/types'
import { formatCurrency } from '@/lib/utils'
import { CheckCircle, AlertTriangle, TrendingDown, TrendingUp } from 'lucide-react'

interface SummaryCardsProps {
  result: ReconciliationResult
}

export function SummaryCards({ result }: SummaryCardsProps) {
  const totalMatched = result.exactMatches + result.fuzzyMatches
  const totalRecords = Math.max(result.totalChargesRecords, result.totalInvoicesRecords)
  const matchRate = totalRecords > 0 ? Math.round((totalMatched / totalRecords) * 100) : 0

  const cards = [
    {
      label: 'Records Matched',
      value: `${totalMatched}`,
      sub: `${matchRate}% match rate · ${result.exactMatches} exact, ${result.fuzzyMatches} AI`,
      icon: CheckCircle,
      iconColor: 'text-emerald-600',
      iconBg: 'bg-emerald-500/10',
      valueColor: 'text-emerald-600',
    },
    {
      label: 'Discrepancies',
      value: `${result.discrepancyCount}`,
      sub: `${result.totalChargesRecords} charges · ${result.totalInvoicesRecords} invoices`,
      icon: AlertTriangle,
      iconColor: 'text-amber-600',
      iconBg: 'bg-amber-500/10',
      valueColor: 'text-amber-600',
    },
    {
      label: 'Revenue Leaked',
      value: formatCurrency(result.totalUnderbilled),
      sub: 'Charged but not billed, or wrong rate',
      icon: TrendingDown,
      iconColor: 'text-red-600',
      iconBg: 'bg-red-500/10',
      valueColor: 'text-red-600',
    },
    {
      label: 'Overbilled',
      value: formatCurrency(result.totalOverbilled),
      sub: 'Invoiced with no corresponding charge',
      icon: TrendingUp,
      iconColor: 'text-orange-600',
      iconBg: 'bg-orange-500/10',
      valueColor: 'text-orange-600',
    },
  ]

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      {cards.map(({ label, value, sub, icon: Icon, iconColor, iconBg, valueColor }) => (
        <div key={label} className="glass rounded-2xl p-5">
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">{label}</p>
            <div className={`w-8 h-8 ${iconBg} rounded-lg flex items-center justify-center flex-shrink-0`}>
              <Icon className={`w-4 h-4 ${iconColor}`} />
            </div>
          </div>
          <p className={`text-2xl font-bold tracking-tight ${valueColor}`}>{value}</p>
          <p className="text-xs text-gray-400 mt-1.5 leading-snug">{sub}</p>
        </div>
      ))}
    </div>
  )
}
