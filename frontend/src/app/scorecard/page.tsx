import { getDataScope } from '@/lib/auth'
import { getRecoveryScorecard } from '@/lib/db'
import { formatCurrency } from '@/lib/utils'
import { BarList, currencyFormatter } from '@/components/OperationalCharts'

export const dynamic = 'force-dynamic'

export default async function ScorecardPage() {
  const scorecard = await getRecoveryScorecard(getDataScope())
  const total = scorecard.totalUnderbilledRecovered + scorecard.totalOverbillingReversed

  return (
    <main className="mx-auto max-w-[1500px] px-6 py-7 lg:px-10">
      <div className="mb-5">
        <p className="text-xs font-semibold uppercase tracking-wide text-blue-600">Revenue recovered</p>
        <h1 className="mt-1 text-3xl font-bold text-gray-900">Recovery scorecard</h1>
        <p className="mt-1 text-[15px] text-gray-500">Track revenue recovered and overbilling reversed from approved resolutions.</p>
      </div>
      <div className="mb-5 grid gap-3 md:grid-cols-4">
        {[
          { label: 'Total impact', value: formatCurrency(total), sub: 'Recovered + reversed' },
          { label: 'Underbilled recovered', value: formatCurrency(scorecard.totalUnderbilledRecovered), sub: 'Revenue captured' },
          { label: 'Overbilling reversed', value: formatCurrency(scorecard.totalOverbillingReversed), sub: 'Customer impact corrected' },
          { label: 'Escalated', value: formatCurrency(scorecard.totalEscalated), sub: 'Pending external action' },
        ].map((card) => (
          <div key={card.label} className="glass rounded-xl p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">{card.label}</p>
            <p className="mt-2 text-2xl font-bold text-gray-900">{card.value}</p>
            <p className="mt-1 text-xs text-gray-400">{card.sub}</p>
          </div>
        ))}
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <BarList title="By product line" valueFormatter={currencyFormatter} items={scorecard.byProductLine.map((row) => ({ label: row.productLine, value: row.amount, colorClass: 'bg-blue-500' }))} />
        <BarList title="By discrepancy type" valueFormatter={currencyFormatter} items={scorecard.byDiscrepancyType.map((row) => ({ label: row.type.replaceAll('_', ' '), value: row.amount, colorClass: 'bg-emerald-500' }))} />
      </div>
    </main>
  )
}
