import { getDataScope, hasRole } from '@/lib/auth'
import { getComplianceControls } from '@/lib/db'
import { ComplianceControlsForm } from '@/components/ComplianceControlsForm'
import { Shield } from 'lucide-react'
import Link from 'next/link'

export const dynamic = 'force-dynamic'

export default async function CompliancePage() {
  if (!(await hasRole('admin'))) {
    return (
      <main className="mx-auto max-w-2xl px-6 py-20 text-center">
        <Shield className="mx-auto mb-4 h-10 w-10 text-gray-300" />
        <p className="text-lg font-semibold text-gray-700">Admin access required</p>
        <Link href="/" className="mt-6 inline-flex text-sm text-blue-600">Back to dashboard</Link>
      </main>
    )
  }
  const controls = await getComplianceControls(getDataScope())
  return (
    <main className="mx-auto max-w-[1200px] px-6 py-7 lg:px-10">
      <div className="mb-5">
        <p className="text-xs font-semibold uppercase tracking-wide text-blue-600">Compliance infrastructure</p>
        <h1 className="mt-1 text-3xl font-bold text-gray-900">SOC 2 and retention controls</h1>
        <p className="mt-1 text-[15px] text-gray-500">Manage evidence collection, retention policy, and privacy posture.</p>
      </div>
      <ComplianceControlsForm initial={controls} />
      <div className="mt-4 grid gap-3 md:grid-cols-3">
        {[
          ['SOC 2 Type I', controls.soc2_process_started_at ? 'Started' : 'Not started'],
          ['Retention', `${controls.retention_days} days`],
          ['Region', controls.data_processing_region.toUpperCase()],
        ].map(([label, value]) => (
          <div key={label} className="glass rounded-xl p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">{label}</p>
            <p className="mt-2 text-xl font-bold text-gray-900">{value}</p>
          </div>
        ))}
      </div>
    </main>
  )
}
