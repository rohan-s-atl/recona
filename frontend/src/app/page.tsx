import Link from 'next/link'
import { getRuns, getUsageSummary } from '@/lib/db'
import { isSupabaseConfigured } from '@/lib/supabase'
import { formatCurrency } from '@/lib/utils'
import { getDataScope } from '@/lib/auth'
import { DonutChart, currencyFormatter } from '@/components/OperationalCharts'
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  Clock,
  Database,
  FileText,
  ShieldCheck,
  Target,
  TrendingDown,
} from 'lucide-react'

export const dynamic = 'force-dynamic'

export default async function HomePage() {
  const configured = isSupabaseConfigured()
  const scope = getDataScope()
  const [runs, usage] = configured
    ? await Promise.all([getRuns(8, scope), getUsageSummary(scope)])
    : [[], null]

  const totalRuns = runs.length
  const totalAtRisk = runs.reduce((s, r) => s + Number(r.total_amount_at_risk), 0)
  const totalIssues = runs.reduce((s, r) => s + r.discrepancy_count, 0)
  const totalUnderbilled = runs.reduce((s, r) => s + Number(r.total_underbilled), 0)
  const totalOverbilled = runs.reduce((s, r) => s + Number(r.total_overbilled), 0)
  const totalRecords = runs.reduce((s, r) => s + r.total_charges_records + r.total_invoices_records, 0)
  const exactMatches = runs.reduce((s, r) => s + r.exact_matches, 0)
  const fuzzyMatches = runs.reduce((s, r) => s + r.fuzzy_matches, 0)
  const issueRuns = runs.filter((run) => run.discrepancy_count > 0).length
  const cleanRuns = Math.max(totalRuns - issueRuns, 0)
  const recentRuns = runs.slice(0, 4)
  const priorityRun = runs.reduce<(typeof runs)[number] | null>(
    (current, run) =>
      !current || Number(run.total_amount_at_risk) > Number(current.total_amount_at_risk) ? run : current,
    null
  )
  const totalMatches = exactMatches + fuzzyMatches
  const reviewedRows = Math.max(totalRecords, 1)
  const reviewCoverage = Math.min(100, Math.round((totalMatches / reviewedRows) * 100))
  const leakageShare = totalAtRisk > 0 ? Math.round((totalUnderbilled / totalAtRisk) * 100) : 0

  return (
    <main className="mx-auto max-w-[1800px] px-6 py-5 lg:px-10">
      <div className="mb-4 flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-blue-600">Command center</p>
          <h1 className="mt-1 text-3xl font-bold tracking-tight text-gray-900">Billing reconciliation</h1>
          <p className="mt-1 text-[15px] text-gray-500">
            Monitor revenue leakage, invoice quality, and contract compliance across every run.
          </p>
        </div>
        <Link
          href="/upload"
          className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-md shadow-blue-500/20 transition-colors hover:bg-blue-700"
        >
          New run
          <ArrowRight className="h-4 w-4" />
        </Link>
      </div>

      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          {
            label: 'Total runs',
            value: totalRuns.toString(),
            sub: `${totalRecords.toLocaleString()} rows reviewed`,
            icon: FileText,
            iconClass: 'text-blue-600',
            iconBg: 'bg-blue-500/10',
          },
          {
            label: 'Issues found',
            value: totalIssues.toString(),
            sub: `${issueRuns} runs need follow-up`,
            icon: AlertTriangle,
            iconClass: 'text-amber-600',
            iconBg: 'bg-amber-500/10',
          },
          {
            label: 'Revenue at risk',
            value: totalAtRisk > 0 ? formatCurrency(totalAtRisk) : '$0.00',
            sub: `${formatCurrency(totalUnderbilled)} leakage`,
            icon: TrendingDown,
            iconClass: 'text-red-600',
            iconBg: 'bg-red-500/10',
          },
          {
            label: 'AI reviewed',
            value: fuzzyMatches.toLocaleString(),
            sub: `${exactMatches.toLocaleString()} exact matches`,
            icon: Activity,
            iconClass: 'text-violet-600',
            iconBg: 'bg-violet-500/10',
          },
        ].map(({ label, value, sub, icon: Icon, iconClass, iconBg }) => (
          <div key={label} className="glass rounded-xl p-3.5">
            <div className="mb-2 flex items-center justify-between">
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">{label}</p>
              <div className={`flex h-8 w-8 items-center justify-center rounded-lg ${iconBg}`}>
                <Icon className={`h-4 w-4 ${iconClass}`} />
              </div>
            </div>
            <p className="text-2xl font-bold tracking-tight text-gray-900">{value}</p>
            <p className="mt-1 text-xs text-gray-400">{sub}</p>
          </div>
        ))}
      </div>

      <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_420px]">
        <div className="space-y-4">
          <div className="glass overflow-hidden rounded-xl">
            <div className="flex items-center justify-between border-b border-white/60 px-4 py-3">
              <div>
                <p className="text-sm font-semibold text-gray-800">Recent reconciliation activity</p>
                <p className="text-xs text-gray-400">Latest control checks across charges, invoices, and contracts</p>
              </div>
              {runs.length > 0 && (
                <Link href="/runs" className="text-xs font-semibold text-blue-600 hover:text-blue-700">
                  View all
                </Link>
              )}
            </div>

            {runs.length === 0 ? (
              <div className="flex flex-col items-center justify-center px-6 py-20 text-center">
                <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-xl bg-blue-500/10">
                  <FileText className="h-7 w-7 text-blue-600" />
                </div>
                <p className="mb-1 text-sm font-semibold text-gray-700">No runs yet</p>
                <p className="max-w-xs text-xs leading-relaxed text-gray-400">
                  Upload charges and invoices to start building an audit-ready reconciliation history.
                </p>
                <Link
                  href="/upload"
                  className="mt-6 flex items-center gap-2 rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white shadow-md shadow-blue-500/20 transition-colors hover:bg-blue-700"
                >
                  Start first reconciliation
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-[15px]">
                  <thead>
                    <tr className="border-b border-white/60 text-xs font-semibold uppercase tracking-wide text-gray-400">
                      <th className="px-4 py-3 text-left">Run</th>
                      <th className="px-4 py-3 text-right">Records</th>
                      <th className="px-4 py-3 text-right">Issues</th>
                      <th className="px-4 py-3 text-right">At risk</th>
                      <th className="px-4 py-3 text-right">Match rate</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/50">
                    {recentRuns.map((run) => {
                      const date = new Date(run.created_at)
                      const records = run.total_charges_records + run.total_invoices_records
                      const matchRate = Math.round(
                        ((run.exact_matches + run.fuzzy_matches) /
                          Math.max(run.total_charges_records, run.total_invoices_records, 1)) *
                          100
                      )

                      return (
                        <tr key={run.id} className="hover:bg-white/40">
                          <td className="px-4 py-3">
                            <Link href={`/runs/${run.id}`} className="flex min-w-[280px] items-center gap-3">
                              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-blue-500/10">
                                <FileText className="h-4 w-4 text-blue-600" />
                              </span>
                              <span className="min-w-0">
                                <span className="block truncate font-semibold text-gray-800">
                                  {run.charges_filename} x {run.invoices_filename}
                                </span>
                                <span className="mt-0.5 flex items-center gap-1 text-xs text-gray-400">
                                  <Clock className="h-3 w-3" />
                                  {date.toLocaleDateString('en-US', {
                                    month: 'short',
                                    day: 'numeric',
                                    year: 'numeric',
                                  })}
                                </span>
                              </span>
                            </Link>
                          </td>
                          <td className="px-4 py-3 text-right font-medium text-gray-700">{records.toLocaleString()}</td>
                          <td
                            className={`px-4 py-3 text-right font-bold ${
                              run.discrepancy_count > 0 ? 'text-red-600' : 'text-emerald-600'
                            }`}
                          >
                            {run.discrepancy_count}
                          </td>
                          <td className="px-4 py-3 text-right font-bold text-gray-900">
                            {formatCurrency(run.total_amount_at_risk)}
                          </td>
                          <td className="px-4 py-3 text-right font-medium text-gray-600">{matchRate}%</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {runs.length > 0 && priorityRun && (
            <div className="glass rounded-xl p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <Target className="h-4 w-4 text-blue-600" />
                    <p className="text-sm font-semibold text-gray-900">Review focus</p>
                  </div>
                  <p className="mt-1 text-xs text-gray-400">Highest-impact run and coverage signals for the queue</p>
                </div>
                <Link
                  href={`/runs/${priorityRun.id}`}
                  className="flex items-center gap-1 rounded-lg bg-blue-600 px-3 py-2 text-xs font-semibold text-white shadow-md shadow-blue-500/20 transition-colors hover:bg-blue-700"
                >
                  Open priority
                  <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </div>
              <div className="mt-4 grid gap-3 md:grid-cols-3">
                <div className="rounded-lg bg-white/45 p-3">
                  <p className="text-xs text-gray-400">Priority exposure</p>
                  <p className="mt-1 text-lg font-bold tracking-tight text-gray-900">
                    {formatCurrency(priorityRun.total_amount_at_risk)}
                  </p>
                  <p className="mt-1 truncate text-xs text-gray-500">
                    {priorityRun.charges_filename} x {priorityRun.invoices_filename}
                  </p>
                </div>
                <div className="rounded-lg bg-white/45 p-3">
                  <p className="text-xs text-gray-400">Review coverage</p>
                  <div className="mt-2 flex items-center gap-3">
                    <ShieldCheck className="h-5 w-5 text-emerald-600" />
                    <p className="text-lg font-bold tracking-tight text-gray-900">{reviewCoverage}%</p>
                  </div>
                  <div className="mt-2 h-1.5 rounded-full bg-gray-200">
                    <div className="h-1.5 rounded-full bg-emerald-500" style={{ width: `${reviewCoverage}%` }} />
                  </div>
                </div>
                <div className="rounded-lg bg-white/45 p-3">
                  <p className="text-xs text-gray-400">Leakage share</p>
                  <p className="mt-1 text-lg font-bold tracking-tight text-red-600">{leakageShare}%</p>
                  <p className="mt-1 text-xs text-gray-500">{formatCurrency(totalUnderbilled)} of exposure is underbilled</p>
                </div>
              </div>
            </div>
          )}
        </div>

        <aside className="space-y-3">
          {runs.length > 0 && (
            <>
              <DonutChart
                title="Risk composition"
                subtitle="Leakage vs customer-impact exposure"
                centerLabel="At risk"
                centerValue={formatCurrency(totalAtRisk)}
                valueFormatter={currencyFormatter}
                segments={[
                  { label: 'Revenue leakage', value: totalUnderbilled, color: '#dc2626', textClass: 'text-red-600' },
                  { label: 'Overbilling exposure', value: totalOverbilled, color: '#f97316', textClass: 'text-orange-600' },
                ]}
              />
              <DonutChart
                title="Run quality"
                subtitle="Runs needing attention"
                centerLabel="Runs"
                centerValue={totalRuns.toString()}
                segments={[
                  { label: 'Needs review', value: issueRuns, color: '#f59e0b', textClass: 'text-amber-600' },
                  { label: 'Clean', value: cleanRuns, color: '#10b981', textClass: 'text-emerald-600' },
                ]}
              />
            </>
          )}
          <div className="glass rounded-xl p-4">
            <div className="flex items-center gap-2">
              <Database className="h-4 w-4 text-blue-600" />
              <p className="text-sm font-semibold text-gray-900">Middle-office queue</p>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
              <div>
                <p className="text-xs text-gray-400">Rows processed</p>
                <p className="mt-1 font-bold text-gray-900">{(usage?.rowsProcessed ?? 0).toLocaleString()}</p>
              </div>
              <div>
                <p className="text-xs text-gray-400">AI assists</p>
                <p className="mt-1 font-bold text-gray-900">{(usage?.aiAssistedMatches ?? 0).toLocaleString()}</p>
              </div>
              <div>
                <p className="text-xs text-gray-400">Discrepancies</p>
                <p className="mt-1 font-bold text-red-600">{(usage?.discrepanciesFound ?? 0).toLocaleString()}</p>
              </div>
              <div>
                <p className="text-xs text-gray-400">Total exposure</p>
                <p className="mt-1 font-bold text-gray-900">{formatCurrency(usage?.totalAmountAtRisk ?? 0)}</p>
              </div>
            </div>
          </div>

        </aside>
      </div>
    </main>
  )
}
