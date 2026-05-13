import Link from 'next/link'
import { getRuns, getUsageSummary } from '@/lib/db'
import { isSupabaseConfigured } from '@/lib/supabase'
import { formatCurrency } from '@/lib/utils'
import { getDataScope } from '@/lib/auth'
import { ArrowRight, FileText, AlertTriangle, TrendingDown, Clock, Upload, CheckCircle } from 'lucide-react'

export const dynamic = 'force-dynamic'

export default async function HomePage() {
  const configured = isSupabaseConfigured()
  const scope = getDataScope()
  const [runs, usage] = configured
    ? await Promise.all([getRuns(5, scope), getUsageSummary(scope)])
    : [[], null]

  const totalRuns = runs.length
  const totalAtRisk = runs.reduce((s, r) => s + Number(r.total_amount_at_risk), 0)
  const totalIssues = runs.reduce((s, r) => s + r.discrepancy_count, 0)

  return (
    <main className="max-w-5xl mx-auto px-6 py-10">
      {/* Header */}
      <div className="flex items-start justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Reconciliation</h1>
          <p className="text-sm text-gray-500 mt-1">
            Compare charges, invoices, and contracted rates — catch every billing discrepancy.
          </p>
        </div>
        <Link
          href="/upload"
          className="flex items-center gap-2 text-sm font-semibold bg-blue-600 text-white px-4 py-2.5 rounded-xl hover:bg-blue-700 transition-colors shadow-md shadow-blue-500/20"
        >
          New run
          <ArrowRight className="w-4 h-4" />
        </Link>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-3 gap-4 mb-8">
        {[
          {
            label: 'Total runs',
            value: totalRuns.toString(),
            icon: FileText,
            iconClass: 'text-blue-600',
            iconBg: 'bg-blue-500/10',
          },
          {
            label: 'Issues found',
            value: totalIssues.toString(),
            icon: AlertTriangle,
            iconClass: 'text-amber-600',
            iconBg: 'bg-amber-500/10',
          },
          {
            label: 'Revenue at risk',
            value: totalAtRisk > 0 ? formatCurrency(totalAtRisk) : '—',
            icon: TrendingDown,
            iconClass: 'text-red-600',
            iconBg: 'bg-red-500/10',
          },
        ].map(({ label, value, icon: Icon, iconClass, iconBg }) => (
          <div key={label} className="glass rounded-2xl p-5">
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">{label}</p>
              <div className={`w-8 h-8 ${iconBg} rounded-lg flex items-center justify-center`}>
                <Icon className={`w-4 h-4 ${iconClass}`} />
              </div>
            </div>
            <p className="text-2xl font-bold text-gray-900 tracking-tight">{value}</p>
          </div>
        ))}
      </div>

      {/* Recent runs or empty state */}
      <div className="glass rounded-2xl overflow-hidden">
        <div className="px-5 py-4 border-b border-white/60 flex items-center justify-between">
          <p className="text-sm font-semibold text-gray-700">Recent runs</p>
          {runs.length > 0 && (
            <Link href="/runs" className="text-xs font-semibold text-blue-600 hover:text-blue-700">
              View all →
            </Link>
          )}
        </div>

        {runs.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 px-6 text-center">
            <div className="w-14 h-14 bg-blue-500/10 rounded-2xl flex items-center justify-center mb-4">
              <FileText className="w-7 h-7 text-blue-600" />
            </div>
            <p className="text-sm font-semibold text-gray-700 mb-1">No runs yet</p>
            <p className="text-xs text-gray-400 max-w-xs leading-relaxed">
              Upload your product charges and billing invoices to find discrepancies automatically.
            </p>
            <Link
              href="/upload"
              className="mt-6 flex items-center gap-2 text-sm font-semibold bg-blue-600 text-white px-5 py-2.5 rounded-xl hover:bg-blue-700 transition-colors shadow-md shadow-blue-500/20"
            >
              Start first reconciliation
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        ) : (
          <div className="divide-y divide-white/50">
            {runs.map((run) => {
              const date = new Date(run.created_at)
              return (
                <Link
                  key={run.id}
                  href={`/runs/${run.id}`}
                  className="flex items-center gap-4 px-5 py-3.5 hover:bg-white/40 transition-colors"
                >
                  <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center flex-shrink-0">
                    <FileText className="w-4 h-4 text-blue-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-800 truncate">
                      {run.charges_filename} × {run.invoices_filename}
                    </p>
                    <p className="text-xs text-gray-400 flex items-center gap-1 mt-0.5">
                      <Clock className="w-3 h-3" />
                      {date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                    </p>
                  </div>
                  <div className="flex items-center gap-5 flex-shrink-0 text-right">
                    <div>
                      <p className="text-xs text-gray-400">Issues</p>
                      <p className={`text-sm font-bold ${run.discrepancy_count > 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                        {run.discrepancy_count}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-400">At risk</p>
                      <p className="text-sm font-bold text-gray-800">{formatCurrency(run.total_amount_at_risk)}</p>
                    </div>
                  </div>
                </Link>
              )
            })}
          </div>
        )}
      </div>

      {totalRuns === 0 && (
        <div className="mt-8 glass rounded-2xl p-5">
          <p className="text-sm font-semibold text-gray-800 mb-4">First run checklist</p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[
              {
                icon: Upload,
                title: 'Upload charges',
                text: 'Use the product or account-management export as the source of truth.',
              },
              {
                icon: FileText,
                title: 'Upload invoices',
                text: 'Use the billing-engine export for the same period.',
              },
              {
                icon: CheckCircle,
                title: 'Add contract rates',
                text: 'Optional, but enables rate, plan, and missing-fee checks.',
              },
            ].map(({ icon: Icon, title, text }) => (
              <div key={title} className="flex gap-3">
                <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center flex-shrink-0">
                  <Icon className="w-4 h-4 text-blue-600" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-gray-700">{title}</p>
                  <p className="text-xs text-gray-400 mt-0.5 leading-relaxed">{text}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {usage && usage.runs > 0 && (
        <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="glass rounded-2xl p-4">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Rows processed</p>
            <p className="text-xl font-bold text-gray-900 mt-2">{usage.rowsProcessed.toLocaleString()}</p>
          </div>
          <div className="glass rounded-2xl p-4">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">AI-assisted matches</p>
            <p className="text-xl font-bold text-gray-900 mt-2">{usage.aiAssistedMatches.toLocaleString()}</p>
          </div>
          <div className="glass rounded-2xl p-4">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Discrepancies found</p>
            <p className="text-xl font-bold text-gray-900 mt-2">{usage.discrepanciesFound.toLocaleString()}</p>
          </div>
        </div>
      )}
    </main>
  )
}
