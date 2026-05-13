import Link from 'next/link'
import { Shield, Users } from 'lucide-react'
import { hasRole } from '@/lib/auth'
import { InviteTeammateForm } from '@/components/InviteTeammateForm'

export const dynamic = 'force-dynamic'

export default async function SettingsPage() {
  const isAdmin = await hasRole('admin')

  if (!isAdmin) {
    return (
      <main className="max-w-2xl mx-auto px-6 py-20 text-center">
        <Shield className="w-10 h-10 text-gray-300 mx-auto mb-4" />
        <p className="text-gray-700 font-semibold text-lg">Admin access required</p>
        <p className="text-sm text-gray-400 mt-2">
          Organization settings are restricted to admins.
        </p>
        <Link href="/" className="mt-6 inline-flex text-sm text-blue-600 hover:underline">
          Back to dashboard
        </Link>
      </main>
    )
  }

  return (
    <main className="max-w-4xl mx-auto px-6 py-10">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
          <p className="text-sm text-gray-500 mt-1">
            Manage access controls and production readiness for your organization.
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs text-gray-400">
          <Users className="w-4 h-4" />
          Admin only
        </div>
      </div>

      <div className="space-y-6">
        <InviteTeammateForm />
        <div className="glass rounded-2xl p-5">
          <p className="text-sm font-semibold text-gray-800">Role model</p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
            {[
              ['Admin', 'Invite teammates, view audit logs, run reconciliations, export data.'],
              ['Analyst', 'Upload files, run reconciliations, view results, export data.'],
              ['Viewer', 'View existing dashboards and run results.'],
            ].map(([title, text]) => (
              <div key={title} className="bg-white/50 rounded-xl p-4 border border-white/60">
                <p className="text-sm font-semibold text-gray-800">{title}</p>
                <p className="text-xs text-gray-500 mt-1 leading-relaxed">{text}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </main>
  )
}
