import { notFound } from 'next/navigation'
import { getRunByShareToken } from '@/lib/db'
import { formatCurrency } from '@/lib/utils'
import { BarList, DonutChart, currencyFormatter } from '@/components/OperationalCharts'

export const dynamic = 'force-dynamic'

export default async function SharedRunPage({ params }: { params: { id: string } }) {
  const run = await getRunByShareToken(params.id)
  if (!run) notFound()

  const totalAtRisk = Number(run.total_amount_at_risk)
  const productSummaries = ((run.product_line_summaries as { productLine: string; totalAtRisk: number; discrepancyCount: number }[]) ?? [])
    .slice(0, 8)
    .map((product) => ({
      label: product.productLine,
      sublabel: `${product.discrepancyCount} issues`,
      value: product.totalAtRisk,
      colorClass: 'bg-blue-500',
    }))

  return (
    <main className="mx-auto max-w-[1200px] px-6 py-8">
      <div className="mb-5">
        <p className="text-xs font-semibold uppercase tracking-wide text-blue-600">Shared read-only report</p>
        <h1 className="mt-1 text-3xl font-bold text-gray-900">Recona reconciliation summary</h1>
        <p className="mt-1 text-sm text-gray-500">
          Generated {new Date(run.created_at).toLocaleString()} from {run.charges_filename} x {run.invoices_filename}
        </p>
      </div>

      <div className="mb-5 grid gap-3 md:grid-cols-4">
        {[
          { label: 'Issues', value: run.discrepancy_count.toLocaleString(), sub: 'Detected discrepancies' },
          { label: 'At risk', value: formatCurrency(totalAtRisk), sub: 'Total exposure' },
          { label: 'Leakage', value: formatCurrency(run.total_underbilled), sub: 'Underbilled' },
          { label: 'Overbilling', value: formatCurrency(run.total_overbilled), sub: 'Customer impact' },
        ].map((card) => (
          <div key={card.label} className="glass rounded-xl p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">{card.label}</p>
            <p className="mt-2 text-2xl font-bold text-gray-900">{card.value}</p>
            <p className="mt-1 text-xs text-gray-400">{card.sub}</p>
          </div>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-[420px_minmax(0,1fr)]">
        <DonutChart
          title="Exposure split"
          centerLabel="Total"
          centerValue={formatCurrency(totalAtRisk)}
          valueFormatter={currencyFormatter}
          segments={[
            { label: 'Underbilled', value: Number(run.total_underbilled), color: '#dc2626', textClass: 'text-red-600' },
            { label: 'Overbilled', value: Number(run.total_overbilled), color: '#f97316', textClass: 'text-orange-600' },
          ]}
        />
        <div className="glass rounded-xl p-5">
          <p className="text-sm font-semibold text-gray-900">Executive summary</p>
          <p className="mt-3 text-sm leading-relaxed text-gray-700">{run.ai_summary ?? 'No summary available.'}</p>
        </div>
      </div>

      <div className="mt-4">
        <BarList title="Product exposure" items={productSummaries} valueFormatter={currencyFormatter} />
      </div>
    </main>
  )
}
