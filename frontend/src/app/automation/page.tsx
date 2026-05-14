import { getDataScope } from '@/lib/auth'
import { getReconciliationSchedules, getSourceSnapshots } from '@/lib/db'
import { AutomationSetup } from '@/components/AutomationSetup'
import { Clock, Database } from 'lucide-react'

export const dynamic = 'force-dynamic'

export default async function AutomationPage() {
  const scope = getDataScope()
  const [snapshots, schedules] = await Promise.all([getSourceSnapshots(scope), getReconciliationSchedules(scope)])

  return (
    <main className="mx-auto max-w-[1600px] px-6 py-7 lg:px-10">
      <div className="mb-5">
        <p className="text-xs font-semibold uppercase tracking-wide text-blue-600">Automation</p>
        <h1 className="mt-1 text-3xl font-bold text-gray-900">Scheduled reconciliation</h1>
        <p className="mt-1 text-[15px] text-gray-500">Run daily, weekly, monthly, or catch provisioning issues in a rolling window.</p>
      </div>

      <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_480px]">
        <div className="space-y-4">
          <div className="glass overflow-hidden rounded-xl">
            <div className="border-b border-white/60 px-4 py-3">
              <p className="text-sm font-semibold text-gray-900">Schedules</p>
              <p className="text-xs text-gray-400">Due schedules are run by POST /api/schedules/dispatch</p>
            </div>
            {schedules.length === 0 ? (
              <div className="px-6 py-14 text-center text-sm text-gray-400">No schedules yet</div>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-white/60 text-xs font-semibold uppercase tracking-wide text-gray-400">
                    <th className="px-4 py-3 text-left">Name</th>
                    <th className="px-4 py-3 text-left">Cadence</th>
                    <th className="px-4 py-3 text-left">Next run</th>
                    <th className="px-4 py-3 text-left">Last result</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/50">
                  {schedules.map((schedule) => (
                    <tr key={schedule.id}>
                      <td className="px-4 py-3 font-semibold text-gray-900">{schedule.name}</td>
                      <td className="px-4 py-3 text-gray-600">{schedule.cadence}</td>
                      <td className="px-4 py-3 text-gray-600">{new Date(schedule.next_run_at).toLocaleString()}</td>
                      <td className="px-4 py-3 text-gray-500">{schedule.last_error ?? schedule.last_run_id ?? '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          <div className="glass overflow-hidden rounded-xl">
            <div className="border-b border-white/60 px-4 py-3">
              <div className="flex items-center gap-2">
                <Database className="h-4 w-4 text-blue-600" />
                <p className="text-sm font-semibold text-gray-900">Source snapshots</p>
              </div>
              <p className="text-xs text-gray-400">Stored parsed files used by scheduled runs</p>
            </div>
            <div className="grid gap-3 p-4 md:grid-cols-3">
              {snapshots.map((snapshot) => (
                <div key={snapshot.id} className="rounded-lg bg-white/50 p-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-blue-600">{snapshot.role}</p>
                  <p className="mt-1 truncate text-sm font-semibold text-gray-900">{snapshot.name}</p>
                  <p className="mt-1 text-xs text-gray-400">{snapshot.row_count.toLocaleString()} rows</p>
                </div>
              ))}
              {snapshots.length === 0 && <p className="text-sm text-gray-400">Upload snapshots via the snapshot API before scheduling.</p>}
            </div>
          </div>
        </div>

        <aside className="space-y-4">
          <AutomationSetup snapshots={snapshots} />
          <div className="glass rounded-xl p-4">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-blue-600" />
              <p className="text-sm font-semibold text-gray-900">Dispatcher</p>
            </div>
            <p className="mt-2 text-xs leading-relaxed text-gray-500">
              Configure cron or your worker to call POST /api/schedules/dispatch with x-worker-secret. This keeps automation server-side and auditable.
            </p>
          </div>
        </aside>
      </div>
    </main>
  )
}
