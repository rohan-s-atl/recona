import Link from 'next/link'
import { getRuns, RunSummary } from '@/lib/db'
import { formatCurrency } from '@/lib/utils'
import { isSupabaseConfigured } from '@/lib/supabase'
import { getDataScope } from '@/lib/auth'
import { FileText, AlertTriangle, TrendingUp, Clock } from 'lucide-react'

export const dynamic = 'force-dynamic'

function RunRow({ run }: { run: RunSummary }) {
  const date = new Date(run.created_at)
  const dateStr = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  const timeStr = date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })

  return (
    <Link
      href={`/runs/${run.id}`}
      className="flex items-center gap-4 px-6 py-4 hover:bg-white/40 transition-colors border-b border-white/50 last:border-0"
    >
      <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center flex-shrink-0">
        <FileText className="w-5 h-5 text-blue-600" />
      </div>

      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-gray-900 truncate">
          {run.charges_filename} × {run.invoices_filename}
        </p>
        <p className="text-xs text-gray-400 mt-0.5 flex items-center gap-1">
          <Clock className="w-3 h-3" />
          {dateStr} at {timeStr}
          {run.has_fee_schedule && (
            <span className="ml-2 bg-emerald-100 text-emerald-700 text-xs font-semibold px-1.5 py-0.5 rounded-full">
              + fee schedule
            </span>
          )}
        </p>
      </div>

      <div className="text-right flex-shrink-0">
        <div className="flex items-center gap-4">
          <div className="text-center hidden sm:block">
            <p className="text-xs text-gray-400">Records</p>
            <p className="text-sm font-semibold text-gray-700">
              {run.total_charges_records + run.total_invoices_records}
            </p>
          </div>
          <div className="text-center">
            <p className="text-xs text-gray-400">Issues</p>
            <p className={`text-sm font-bold ${run.discrepancy_count > 0 ? 'text-red-600' : 'text-emerald-600'}`}>
              {run.discrepancy_count}
            </p>
          </div>
          <div className="text-center min-w-[90px]">
            <p className="text-xs text-gray-400">At Risk</p>
            <p className={`text-sm font-bold ${run.total_amount_at_risk > 0 ? 'text-red-600' : 'text-gray-400'}`}>
              {formatCurrency(run.total_amount_at_risk)}
            </p>
          </div>
        </div>
      </div>
    </Link>
  )
}

export default async function RunsPage() {
  const configured = isSupabaseConfigured()
  const runs = configured ? await getRuns(50, getDataScope()) : []

  return (
    <main className="max-w-4xl mx-auto px-6 py-10">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Reconciliation runs</h1>
          <p className="text-sm text-gray-500 mt-1">
            Every run is stored with a permanent URL you can share with your team.
          </p>
        </div>
        <Link
          href="/upload"
          className="text-sm font-semibold bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
        >
          New run
        </Link>
      </div>

      {!configured && (
        <div className="glass border-amber-200/40 rounded-xl p-5 mb-8 flex gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-amber-800">Database not connected</p>
            <p className="text-sm text-amber-700 mt-1">
              Set <code className="bg-amber-100 px-1 rounded">NEXT_PUBLIC_SUPABASE_URL</code> and{' '}
              <code className="bg-amber-100 px-1 rounded">SUPABASE_SERVICE_ROLE_KEY</code> in your{' '}
              <code className="bg-amber-100 px-1 rounded">.env.local</code> to enable run persistence.
              Run the SQL in <code className="bg-amber-100 px-1 rounded">docs/schema.sql</code> against
              your Supabase project first.
            </p>
          </div>
        </div>
      )}

      {configured && runs.length === 0 && (
        <div className="text-center py-20 glass rounded-2xl">
          <TrendingUp className="w-10 h-10 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-500 font-medium">No runs yet</p>
          <p className="text-sm text-gray-400 mt-1">
            Run your first reconciliation to see results here.
          </p>
          <Link
            href="/upload"
            className="mt-6 inline-flex text-sm font-semibold bg-blue-600 text-white px-5 py-2.5 rounded-lg hover:bg-blue-700 transition-colors"
          >
            Start reconciliation
          </Link>
        </div>
      )}

      {runs.length > 0 && (
        <>
          {/* Summary stats bar */}
          <div className="grid grid-cols-3 gap-4 mb-6">
            {[
              {
                label: 'Total runs',
                value: runs.length.toString(),
                icon: FileText,
                color: 'text-blue-600 bg-blue-50',
              },
              {
                label: 'Total discrepancies',
                value: runs.reduce((s, r) => s + r.discrepancy_count, 0).toString(),
                icon: AlertTriangle,
                color: 'text-red-600 bg-red-50',
              },
              {
                label: 'Total revenue at risk',
                value: formatCurrency(runs.reduce((s, r) => s + r.total_amount_at_risk, 0)),
                icon: TrendingUp,
                color: 'text-orange-600 bg-orange-50',
              },
            ].map(({ label, value, icon: Icon, color }) => (
              <div key={label} className="glass rounded-xl p-4 flex items-center gap-3">
                <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${color}`}>
                  <Icon className="w-4 h-4" />
                </div>
                <div>
                  <p className="text-xs text-gray-500">{label}</p>
                  <p className="text-base font-bold text-gray-900">{value}</p>
                </div>
              </div>
            ))}
          </div>

          <div className="glass rounded-2xl overflow-hidden">
            {runs.map((run) => (
              <RunRow key={run.id} run={run} />
            ))}
          </div>
        </>
      )}
    </main>
  )
}
