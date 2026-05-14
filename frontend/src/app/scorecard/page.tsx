import { getDataScope } from '@/lib/auth'
import { getRecoveryScorecard } from '@/lib/db'
import { formatCurrency } from '@/lib/utils'
import { BarList, currencyFormatter } from '@/components/OperationalCharts'
import Link from 'next/link'
import { ArrowRight, BadgeDollarSign } from 'lucide-react'

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
        {total === 0 ? (
          <div className="glass rounded-xl px-6 py-16 text-center lg:col-span-2">
            <BadgeDollarSign className="mx-auto mb-3 h-10 w-10 text-gray-300" />
            <p className="text-sm font-semibold text-gray-700">No approved recovery yet</p>
            <p className="mx-auto mt-1 max-w-md text-xs leading-relaxed text-gray-400">
              Approve suggested resolutions to resolve discrepancies and write recovered revenue or reversed overbilling here.
            </p>
            <Link href="/resolutions" className="mt-5 inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white">
              Open resolution approvals
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        ) : (
          <>
            <BarList title="By product line" valueFormatter={currencyFormatter} items={scorecard.byProductLine.map((row) => ({ label: row.productLine, value: row.amount, colorClass: 'bg-blue-500' }))} />
            <BarList title="By discrepancy type" valueFormatter={currencyFormatter} items={scorecard.byDiscrepancyType.map((row) => ({ label: row.type.replaceAll('_', ' '), value: row.amount, colorClass: 'bg-emerald-500' }))} />
          </>
        )}
      </div>
    </main>
  )
}
