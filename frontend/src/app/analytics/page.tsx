import { getDataScope } from '@/lib/auth'
import { getWorkflowAnalytics } from '@/lib/db'
import { formatCurrency } from '@/lib/utils'
import { BarList, currencyFormatter } from '@/components/OperationalCharts'
import { TrendingUp } from 'lucide-react'

export const dynamic = 'force-dynamic'

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

export default async function AnalyticsPage() {
  const analytics = await getWorkflowAnalytics(getDataScope())
  const maxMonth = Math.max(...analytics.monthTrend.map((month) => month.atRisk), 1)
  const rootCauseItems = Object.entries(analytics.rootCauseCounts)
    .sort(([, a], [, b]) => b - a)
    .map(([label, value]) => ({
      label: ROOT_CAUSE_LABEL[label] ?? label,
      value,
      colorClass: 'bg-blue-500',
    }))

  return (
    <main className="mx-auto max-w-[1800px] px-6 py-7 lg:px-10">
      <div className="mb-5 flex items-center justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-blue-600">Workflow intelligence</p>
          <h1 className="mt-1 text-3xl font-bold text-gray-900">Trend analytics</h1>
          <p className="mt-1 text-[15px] text-gray-500">
            Leakage trends, root causes, chronic offenders, and resolution performance.
          </p>
        </div>
        <ExportButton />
      </div>

      <div className="mb-5 grid gap-3 md:grid-cols-5">
        {[
          { label: 'Open', value: analytics.open.toString(), sub: 'Needs owner' },
          { label: 'In review', value: analytics.inReview.toString(), sub: 'Actively owned' },
          { label: 'Resolved', value: analytics.resolved.toString(), sub: `${analytics.resolutionRate}% close rate` },
          { label: 'Overdue', value: analytics.overdue.toString(), sub: 'Past due' },
          { label: 'Recovered', value: formatCurrency(analytics.recovered), sub: 'Corrected resolutions' },
        ].map((card) => (
          <div key={card.label} className="glass rounded-xl p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">{card.label}</p>
            <p className="mt-2 text-2xl font-bold text-gray-900">{card.value}</p>
            <p className="mt-1 text-xs text-gray-400">{card.sub}</p>
          </div>
        ))}
      </div>

      <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_420px]">
        <div className="glass rounded-xl p-4">
          <div className="mb-4 flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-blue-600" />
            <p className="text-sm font-semibold text-gray-900">Month-over-month leakage</p>
          </div>
          <div className="space-y-3">
            {analytics.monthTrend.length === 0 && <p className="py-12 text-center text-sm text-gray-400">No trend data yet</p>}
            {analytics.monthTrend.map((month) => (
              <div key={month.month} className="grid grid-cols-[90px_minmax(0,1fr)_120px] items-center gap-3 text-sm">
                <p className="font-semibold text-gray-700">{month.month}</p>
                <div className="h-3 rounded-full bg-white/70">
                  <div
                    className="h-3 rounded-full bg-red-500"
                    style={{ width: `${Math.max(4, Math.round((month.atRisk / maxMonth) * 100))}%` }}
                  />
                </div>
                <p className="text-right font-bold text-gray-900">{formatCurrency(month.atRisk)}</p>
              </div>
            ))}
          </div>
        </div>

        <aside className="space-y-3">
          <BarList title="Root causes" items={rootCauseItems} />
          <BarList
            title="Chronic offenders"
            valueFormatter={(value) => `${value}x`}
            items={analytics.chronicMerchants.map((merchant) => ({
              label: merchant.merchantName,
              sublabel: formatCurrency(merchant.atRisk),
              value: merchant.occurrences,
              colorClass: 'bg-amber-500',
            }))}
          />
          <BarList
            title="Product exposure"
            valueFormatter={currencyFormatter}
            items={analytics.productTrend.map((product) => ({
              label: product.productLine,
              sublabel: `${product.issues} issues`,
              value: product.atRisk,
              colorClass: 'bg-blue-500',
            }))}
          />
        </aside>
      </div>
    </main>
  )
}

function ExportButton() {
  return (
    <form action="/api/analytics/export" method="get">
      <button className="rounded-lg bg-white/70 px-4 py-2 text-sm font-semibold text-blue-600 shadow-sm transition-colors hover:bg-white">
        Export CSV
      </button>
    </form>
  )
}
