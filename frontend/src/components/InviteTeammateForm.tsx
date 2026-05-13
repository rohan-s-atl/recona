'use client'

import { useState } from 'react'
import { Send, CheckCircle, AlertCircle } from 'lucide-react'

type Role = 'admin' | 'analyst' | 'viewer'

export function InviteTeammateForm() {
  const [email, setEmail] = useState('')
  const [role, setRole] = useState<Role>('analyst')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    setIsSubmitting(true)
    setMessage(null)
    setError(null)

    try {
      const res = await fetch('/api/invitations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, role }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Invite failed')
      setMessage(`Invitation sent to ${data.email}`)
      setEmail('')
      setRole('analyst')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Invite failed')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <form onSubmit={submit} className="glass rounded-2xl p-5 space-y-4">
      <div>
        <h2 className="text-base font-bold text-gray-900">Invite teammate</h2>
        <p className="text-sm text-gray-500 mt-1">
          Invitations are sent through Clerk and scoped to the active organization.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-[1fr_160px_auto] gap-3">
        <input
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder="teammate@company.com"
          className="text-sm bg-white/70 border border-white/70 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500/40"
          required
        />
        <select
          value={role}
          onChange={(event) => setRole(event.target.value as Role)}
          className="text-sm bg-white/70 border border-white/70 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500/40"
        >
          <option value="admin">Admin</option>
          <option value="analyst">Analyst</option>
          <option value="viewer">Viewer</option>
        </select>
        <button
          type="submit"
          disabled={isSubmitting}
          className="inline-flex items-center justify-center gap-2 text-sm font-semibold bg-blue-600 text-white px-4 py-2.5 rounded-xl hover:bg-blue-700 transition-colors disabled:opacity-60"
        >
          <Send className="w-4 h-4" />
          {isSubmitting ? 'Sending' : 'Invite'}
        </button>
      </div>

      {message && (
        <p className="text-sm text-emerald-700 flex items-center gap-2">
          <CheckCircle className="w-4 h-4" />
          {message}
        </p>
      )}
      {error && (
        <p className="text-sm text-red-600 flex items-center gap-2">
          <AlertCircle className="w-4 h-4" />
          {error}
        </p>
      )}
    </form>
  )
}
