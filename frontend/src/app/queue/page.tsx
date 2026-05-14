import Link from 'next/link'
import { getCurrentUserLabel, getDataScope } from '@/lib/auth'
import { getAssignedDiscrepancies } from '@/lib/db'
import { formatCurrency } from '@/lib/utils'
import { AlertTriangle, Clock, ExternalLink } from 'lucide-react'

export const dynamic = 'force-dynamic'

export default async function QueuePage() {
  const user = await getCurrentUserLabel()
  const rows = user ? await getAssignedDiscrepancies(user, getDataScope()) : []
  const overdue = rows.filter((row) => row.due_at && new Date(row.due_at).getTime() < Date.now()).length
  const totalAtRisk = rows.reduce((sum, row) => sum + Number(row.amount_at_risk), 0)

  return (
    <main className="mx-auto max-w-[1400px] px-6 py-7 lg:px-10">
      <div className="mb-5">
        <p className="text-xs font-semibold uppercase tracking-wide text-blue-600">Workflow</p>
        <h1 className="mt-1 text-3xl font-bold text-gray-900">My queue</h1>
        <p className="mt-1 text-[15px] text-gray-500">Open discrepancies assigned to {user ?? 'you'}.</p>
      </div>

      <div className="mb-5 grid gap-3 md:grid-cols-3">
        {[
          { label: 'Assigned', value: rows.length.toString(), sub: 'Open or in review' },
          { label: 'Overdue', value: overdue.toString(), sub: 'Past due date' },
          { label: 'At risk', value: formatCurrency(totalAtRisk), sub: 'Current queue exposure' },
        ].map((card) => (
          <div key={card.label} className="glass rounded-xl p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">{card.label}</p>
            <p className="mt-2 text-2xl font-bold text-gray-900">{card.value}</p>
            <p className="mt-1 text-xs text-gray-400">{card.sub}</p>
          </div>
        ))}
      </div>

      <div className="glass overflow-hidden rounded-xl">
        <div className="border-b border-white/60 px-4 py-3">
          <p className="text-sm font-semibold text-gray-900">Assigned issues</p>
          <p className="text-xs text-gray-400">Sorted by due date, then exposure</p>
        </div>
        {rows.length === 0 ? (
          <div className="px-6 py-16 text-center">
            <AlertTriangle className="mx-auto mb-3 h-9 w-9 text-gray-300" />
            <p className="text-sm font-semibold text-gray-600">Nothing assigned right now</p>
            <p className="mt-1 text-xs text-gray-400">Assigned discrepancies will appear here.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/60 text-xs font-semibold uppercase tracking-wide text-gray-400">
                  <th className="px-4 py-3 text-left">Merchant</th>
                  <th className="px-4 py-3 text-left">Issue</th>
                  <th className="px-4 py-3 text-right">At risk</th>
                  <th className="px-4 py-3 text-left">Due</th>
                  <th className="px-4 py-3 text-left">Note</th>
                  <th className="px-4 py-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/50">
                {rows.map((row) => (
                  <tr key={row.id} className="hover:bg-white/40">
                    <td className="px-4 py-3 font-semibold text-gray-900">{row.merchant_name}</td>
                    <td className="px-4 py-3 text-gray-600">{row.type.replaceAll('_', ' ')}</td>
                    <td className="px-4 py-3 text-right font-bold text-red-600">{formatCurrency(row.amount_at_risk)}</td>
                    <td className="px-4 py-3 text-gray-500">
                      {row.due_at ? (
                        <span className="inline-flex items-center gap-1">
                          <Clock className="h-3.5 w-3.5" />
                          {new Date(row.due_at).toLocaleDateString()}
                        </span>
                      ) : (
                        '-'
                      )}
                    </td>
                    <td className="max-w-xs truncate px-4 py-3 text-gray-500">{row.assignment_note ?? '-'}</td>
                    <td className="px-4 py-3 text-right">
                      <Link
                        href={`/runs/${row.run_id}`}
                        className="inline-flex items-center gap-1 rounded-lg bg-white/70 px-2.5 py-1.5 text-xs font-semibold text-blue-600"
                      >
                        Open run
                        <ExternalLink className="h-3.5 w-3.5" />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </main>
  )
}
