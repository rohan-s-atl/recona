import Link from 'next/link'
import { getRuns, RunSummary } from '@/lib/db'
import { formatCurrency } from '@/lib/utils'
import { isSupabaseConfigured } from '@/lib/supabase'
import { getDataScope } from '@/lib/auth'
import { BarList, DonutChart, currencyFormatter } from '@/components/OperationalCharts'
import { AlertTriangle, ArrowUpRight, Clock, FileText, TrendingUp } from 'lucide-react'

export const dynamic = 'force-dynamic'

function RunRow({ run }: { run: RunSummary }) {
  const date = new Date(run.created_at)
  const dateStr = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  const timeStr = date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
  const records = run.total_charges_records + run.total_invoices_records
  const matchRate = Math.round(
    ((run.exact_matches + run.fuzzy_matches) / Math.max(run.total_charges_records, run.total_invoices_records, 1)) *
      100
  )

  return (
    <tr className="border-b border-white/50 transition-colors last:border-0 hover:bg-white/40">
      <td className="px-4 py-3">
        <Link href={`/runs/${run.id}`} className="flex min-w-[360px] items-center gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-blue-50">
            <FileText className="h-4 w-4 text-blue-600" />
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-gray-900">
              {run.charges_filename} x {run.invoices_filename}
            </p>
            <p className="mt-0.5 flex items-center gap-1 text-xs text-gray-400">
              <Clock className="h-3 w-3" />
              {dateStr} at {timeStr}
              {run.has_fee_schedule && (
                <span className="ml-2 rounded-full bg-emerald-100 px-1.5 py-0.5 text-xs font-semibold text-emerald-700">
                  fee schedule
                </span>
              )}
            </p>
          </div>
        </Link>
      </td>
      <td className="px-4 py-3 text-right text-sm font-medium text-gray-700">{records.toLocaleString()}</td>
      <td className="px-4 py-3 text-right text-sm font-medium text-gray-700">{matchRate}%</td>
      <td className="px-4 py-3 text-right text-sm font-bold text-gray-900">{run.discrepancy_count}</td>
      <td className="px-4 py-3 text-right text-sm font-bold text-red-600">{formatCurrency(run.total_underbilled)}</td>
      <td className="px-4 py-3 text-right text-sm font-bold text-orange-600">{formatCurrency(run.total_overbilled)}</td>
      <td className="px-4 py-3 text-right text-sm font-bold text-gray-900">
        {formatCurrency(run.total_amount_at_risk)}
      </td>
      <td className="px-4 py-3 text-right">
        <Link
          href={`/runs/${run.id}`}
          className="inline-flex items-center gap-1 rounded-lg bg-white/60 px-2.5 py-1.5 text-xs font-semibold text-blue-600 transition-colors hover:bg-white"
        >
          Open
          <ArrowUpRight className="h-3.5 w-3.5" />
        </Link>
      </td>
    </tr>
  )
}

export default async function RunsPage() {
  const configured = isSupabaseConfigured()
  const runs = configured ? await getRuns(100, getDataScope()) : []

  const totalRuns = runs.length
  const totalDiscrepancies = runs.reduce((s, r) => s + r.discrepancy_count, 0)
  const totalAtRisk = runs.reduce((s, r) => s + Number(r.total_amount_at_risk), 0)
  const totalUnderbilled = runs.reduce((s, r) => s + Number(r.total_underbilled), 0)
  const totalOverbilled = runs.reduce((s, r) => s + Number(r.total_overbilled), 0)
  const totalRows = runs.reduce((s, r) => s + r.total_charges_records + r.total_invoices_records, 0)
  const issueRuns = runs.filter((run) => run.discrepancy_count > 0).length
  const cleanRuns = Math.max(totalRuns - issueRuns, 0)
  const highRiskRuns = [...runs]
    .sort((a, b) => Number(b.total_amount_at_risk) - Number(a.total_amount_at_risk))
    .slice(0, 6)

  return (
    <main className="mx-auto max-w-[1800px] px-6 py-7 lg:px-10">
      <div className="mb-5 flex items-center justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-blue-600">Run ledger</p>
          <h1 className="mt-1 text-3xl font-bold text-gray-900">Reconciliation runs</h1>
          <p className="mt-1 text-[15px] text-gray-500">
            Audit-ready history for finance, product operations, and exception management.
          </p>
        </div>
        <Link
          href="/upload"
          className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-blue-700"
        >
          New run
        </Link>
      </div>

      {!configured && (
        <div className="glass mb-5 flex gap-3 rounded-xl border-amber-200/40 p-5">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
          <div>
            <p className="text-sm font-semibold text-amber-800">Database not connected</p>
            <p className="mt-1 text-sm text-amber-700">
              Set Supabase environment variables and run the SQL in <code>docs/schema.sql</code> to enable run
              persistence.
            </p>
          </div>
        </div>
      )}

      {configured && runs.length === 0 && (
        <div className="glass rounded-xl py-20 text-center">
          <TrendingUp className="mx-auto mb-4 h-10 w-10 text-gray-300" />
          <p className="font-medium text-gray-500">No runs yet</p>
          <p className="mt-1 text-sm text-gray-400">Run your first reconciliation to see results here.</p>
          <Link
            href="/upload"
            className="mt-6 inline-flex rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-blue-700"
          >
            Start reconciliation
          </Link>
        </div>
      )}

      {runs.length > 0 && (
        <>
          <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
            {[
              { label: 'Runs', value: totalRuns.toString(), sub: `${totalRows.toLocaleString()} rows` },
              { label: 'Discrepancies', value: totalDiscrepancies.toString(), sub: `${issueRuns} runs with issues` },
              { label: 'Revenue leakage', value: formatCurrency(totalUnderbilled), sub: 'Finance recovery' },
              { label: 'Total exposure', value: formatCurrency(totalAtRisk), sub: 'Leakage + overbilling' },
            ].map((card) => (
              <div key={card.label} className="glass rounded-xl p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">{card.label}</p>
                <p className="mt-2 text-2xl font-bold text-gray-900">{card.value}</p>
                <p className="mt-1 text-xs text-gray-400">{card.sub}</p>
              </div>
            ))}
          </div>

          <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_430px]">
            <div className="glass overflow-hidden rounded-xl">
              <div className="border-b border-white/60 px-4 py-3">
                <p className="text-sm font-semibold text-gray-900">Run history</p>
                <p className="text-xs text-gray-400">Dense ledger view for triage and review</p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-[15px]">
                  <thead>
                    <tr className="border-b border-white/60 text-xs font-semibold uppercase tracking-wide text-gray-400">
                      <th className="px-4 py-3 text-left">Run</th>
                      <th className="px-4 py-3 text-right">Records</th>
                      <th className="px-4 py-3 text-right">Match</th>
                      <th className="px-4 py-3 text-right">Issues</th>
                      <th className="px-4 py-3 text-right">Leakage</th>
                      <th className="px-4 py-3 text-right">Overbilling</th>
                      <th className="px-4 py-3 text-right">At risk</th>
                      <th className="px-4 py-3 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {runs.map((run) => (
                      <RunRow key={run.id} run={run} />
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <aside className="space-y-3">
              <DonutChart
                title="Exposure mix"
                centerLabel="Total"
                centerValue={formatCurrency(totalAtRisk)}
                valueFormatter={currencyFormatter}
                segments={[
                  { label: 'Underbilled', value: totalUnderbilled, color: '#dc2626', textClass: 'text-red-600' },
                  { label: 'Overbilled', value: totalOverbilled, color: '#f97316', textClass: 'text-orange-600' },
                ]}
              />
              <DonutChart
                title="Run outcomes"
                centerLabel="Runs"
                centerValue={totalRuns.toString()}
                segments={[
                  { label: 'Needs review', value: issueRuns, color: '#f59e0b', textClass: 'text-amber-600' },
                  { label: 'Clean', value: cleanRuns, color: '#10b981', textClass: 'text-emerald-600' },
                ]}
              />
              <BarList
                title="Highest-risk runs"
                valueFormatter={currencyFormatter}
                items={highRiskRuns.map((run) => ({
                  label: run.charges_filename,
                  sublabel: `${run.discrepancy_count} issues`,
                  value: Number(run.total_amount_at_risk),
                  colorClass: 'bg-red-500',
                }))}
              />
            </aside>
          </div>
        </>
      )}
    </main>
  )
}
