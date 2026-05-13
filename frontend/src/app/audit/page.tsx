import Link from 'next/link'
import { Shield, AlertTriangle } from 'lucide-react'
import { getAuditLog } from '@/lib/db'
import { isSupabaseConfigured } from '@/lib/supabase'
import { getDataScope, hasRole } from '@/lib/auth'
import { AuditLogView } from '@/components/AuditLogView'

export const dynamic = 'force-dynamic'

export default async function AuditPage() {
  const isAdmin = await hasRole('admin')

  if (!isAdmin) {
    return (
      <main className="max-w-2xl mx-auto px-6 py-20 text-center">
        <Shield className="w-10 h-10 text-gray-300 mx-auto mb-4" />
        <p className="text-gray-700 font-semibold text-lg">Admin access required</p>
        <p className="text-sm text-gray-400 mt-2 max-w-sm mx-auto">
          The audit log is restricted to admin users. Ask your organization admin to grant you access,
          or set <code className="bg-gray-100 px-1 rounded">publicMetadata.role = &quot;admin&quot;</code> in the Clerk dashboard.
        </p>
        <Link href="/" className="mt-6 inline-flex text-sm text-blue-600 hover:underline">
          ← Back to dashboard
        </Link>
      </main>
    )
  }

  const configured = isSupabaseConfigured()
  const entries = configured ? await getAuditLog({ limit: 500, ...getDataScope() }) : []

  return (
    <main className="max-w-6xl mx-auto px-6 py-10">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Audit log</h1>
          <p className="text-sm text-gray-500 mt-1">
            Non-deletable record of every action taken in Recona.
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs text-gray-400">
          <Shield className="w-4 h-4" />
          Admin only
        </div>
      </div>

      {!configured && (
        <div className="glass border-amber-200/40 rounded-xl p-5 mb-8 flex gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-amber-800">Database not connected</p>
            <p className="text-sm text-amber-700 mt-1">
              Set Supabase environment variables to enable audit logging.
            </p>
          </div>
        </div>
      )}

      {configured && entries.length === 0 && (
        <div className="text-center py-20 glass rounded-2xl">
          <Shield className="w-10 h-10 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-500 font-medium">No audit entries yet</p>
          <p className="text-sm text-gray-400 mt-1">
            Actions will appear here as users run reconciliations and interact with the app.
          </p>
        </div>
      )}

      {entries.length > 0 && <AuditLogView entries={entries} />}
    </main>
  )
}
