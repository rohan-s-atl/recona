'use client'

import { useEffect, useState } from 'react'
import { formatCurrency } from '@/lib/utils'

interface Suggestion {
  id: string
  title: string
  proposed_action: string
  suggestion_type: string
  confidence_score: number
  status: string
  payload: { amount?: number; product_line?: string }
}

export default function ResolutionsPage() {
  const [suggestions, setSuggestions] = useState<Suggestion[]>([])
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [status, setStatus] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/resolutions')
      .then((res) => res.json())
      .then((json) => setSuggestions(json.suggestions ?? []))
      .catch(() => setStatus('Unable to load suggestions'))
  }, [])

  async function approve() {
    const response = await fetch('/api/resolutions', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'approve', ids: [...selected] }),
    })
    const json = await response.json()
    setStatus(response.ok ? `Approved ${json.approved} suggestions` : json.error ?? 'Approval failed')
    if (response.ok) window.location.reload()
  }

  return (
    <main className="mx-auto max-w-[1500px] px-6 py-7 lg:px-10">
      <div className="mb-5 flex items-center justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-blue-600">AI suggested resolutions</p>
          <h1 className="mt-1 text-3xl font-bold text-gray-900">Resolution approvals</h1>
          <p className="mt-1 text-[15px] text-gray-500">Approve concrete recovery actions and write them to the recovery ledger.</p>
        </div>
        <button disabled={selected.size === 0} onClick={approve} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-40">
          Approve selected
        </button>
      </div>
      {status && <p className="mb-4 text-sm font-semibold text-gray-500">{status}</p>}
      <div className="glass overflow-hidden rounded-xl">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-white/60 text-xs font-semibold uppercase tracking-wide text-gray-400">
              <th className="px-4 py-3 text-left">Select</th>
              <th className="px-4 py-3 text-left">Suggestion</th>
              <th className="px-4 py-3 text-left">Type</th>
              <th className="px-4 py-3 text-right">Amount</th>
              <th className="px-4 py-3 text-right">Confidence</th>
              <th className="px-4 py-3 text-left">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/50">
            {suggestions.map((suggestion) => (
              <tr key={suggestion.id} className="hover:bg-white/40">
                <td className="px-4 py-3">
                  <input
                    type="checkbox"
                    disabled={suggestion.status !== 'pending'}
                    checked={selected.has(suggestion.id)}
                    onChange={() => setSelected((prev) => {
                      const next = new Set(prev)
                      next.has(suggestion.id) ? next.delete(suggestion.id) : next.add(suggestion.id)
                      return next
                    })}
                    className="h-4 w-4 rounded border-gray-300"
                  />
                </td>
                <td className="px-4 py-3">
                  <p className="font-semibold text-gray-900">{suggestion.title}</p>
                  <p className="mt-1 text-xs text-gray-500">{suggestion.proposed_action}</p>
                </td>
                <td className="px-4 py-3 text-gray-600">{suggestion.suggestion_type.replaceAll('_', ' ')}</td>
                <td className="px-4 py-3 text-right font-bold text-gray-900">{formatCurrency(Number(suggestion.payload?.amount ?? 0))}</td>
                <td className="px-4 py-3 text-right font-semibold text-blue-600">{Math.round(suggestion.confidence_score * 100)}%</td>
                <td className="px-4 py-3 text-gray-600">{suggestion.status}</td>
              </tr>
            ))}
            {suggestions.length === 0 && (
              <tr><td colSpan={6} className="px-4 py-16 text-center text-gray-400">No suggestions yet</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </main>
  )
}
