'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { formatCurrency } from '@/lib/utils'
import { ArrowRight, CheckCircle2, RefreshCw, Sparkles } from 'lucide-react'

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
  const pendingCount = suggestions.filter((suggestion) => suggestion.status === 'pending').length
  const pendingIds = suggestions.filter((suggestion) => suggestion.status === 'pending').map((suggestion) => suggestion.id)
  const selectedAmount = suggestions
    .filter((suggestion) => selected.has(suggestion.id))
    .reduce((sum, suggestion) => sum + Number(suggestion.payload?.amount ?? 0), 0)

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
    if (response.ok) {
      setSuggestions((current) =>
        current.map((suggestion) =>
          selected.has(suggestion.id) ? { ...suggestion, status: 'approved' } : suggestion
        )
      )
      setSelected(new Set())
    }
  }

  async function generateMissing() {
    setStatus('Generating suggestions for existing runs...')
    const response = await fetch('/api/resolutions', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'generate_missing' }),
    })
    const json = await response.json()
    setStatus(response.ok ? `Generated ${json.created} suggestions` : json.error ?? 'Generation failed')
    if (response.ok) {
      const refreshed = await fetch('/api/resolutions').then((res) => res.json())
      setSuggestions(refreshed.suggestions ?? [])
    }
  }

  function toggleAllPending() {
    setSelected((prev) => {
      const allSelected = pendingIds.length > 0 && pendingIds.every((id) => prev.has(id))
      return allSelected ? new Set() : new Set(pendingIds)
    })
  }

  return (
    <main className="mx-auto max-w-[1500px] px-6 py-7 lg:px-10">
      <div className="mb-5 flex items-center justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-blue-600">AI suggested resolutions</p>
          <h1 className="mt-1 text-3xl font-bold text-gray-900">Resolution approvals</h1>
          <p className="mt-1 text-[15px] text-gray-500">
            This is the approval desk for suggested fixes. Approvals resolve discrepancies and update the recovery scorecard.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={generateMissing} className="inline-flex items-center gap-2 rounded-lg bg-white/70 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-white">
            <RefreshCw className="h-4 w-4" />
            Generate missing
          </button>
          <button disabled={selected.size === 0} onClick={approve} className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-40">
            <CheckCircle2 className="h-4 w-4" />
            Approve selected
          </button>
        </div>
      </div>
      <div className="mb-5 grid gap-3 md:grid-cols-3">
        {[
          { label: 'Pending approvals', value: pendingCount.toString(), sub: 'Need review before ledger impact' },
          { label: 'Selected impact', value: formatCurrency(selectedAmount), sub: `${selected.size} suggestions selected` },
          { label: 'Where this goes', value: 'Scorecard', sub: 'Approved items update recovery metrics' },
        ].map((card) => (
          <div key={card.label} className="glass rounded-xl p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">{card.label}</p>
            <p className="mt-2 text-2xl font-bold text-gray-900">{card.value}</p>
            <p className="mt-1 text-xs text-gray-400">{card.sub}</p>
          </div>
        ))}
      </div>
      <div className="mb-5 glass rounded-xl p-4">
        <div className="grid gap-3 md:grid-cols-3">
          {[
            { step: '1', title: 'Generate from open issues', body: 'New runs create suggestions automatically. Older runs can be backfilled here.' },
            { step: '2', title: 'Approve pending actions', body: 'Approvals resolve the discrepancy and write a recovery ledger entry.' },
            { step: '3', title: 'Track finance impact', body: 'Approved recoveries and reversals appear on the scorecard.' },
          ].map((item) => (
            <div key={item.step} className="flex gap-3 rounded-lg bg-white/45 p-3">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-blue-600 text-xs font-bold text-white">
                {item.step}
              </span>
              <span>
                <span className="block text-sm font-semibold text-gray-900">{item.title}</span>
                <span className="mt-1 block text-xs leading-relaxed text-gray-500">{item.body}</span>
              </span>
            </div>
          ))}
        </div>
      </div>
      {status && <p className="mb-4 text-sm font-semibold text-gray-500">{status}</p>}
      <div className="glass overflow-hidden rounded-xl">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/60 px-4 py-3">
          <div>
            <p className="text-sm font-semibold text-gray-900">Approval queue</p>
            <p className="text-xs text-gray-400">Only pending suggestions can be approved</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              disabled={pendingIds.length === 0}
              onClick={toggleAllPending}
              className="rounded-lg bg-white/70 px-3 py-2 text-xs font-semibold text-gray-700 hover:bg-white disabled:opacity-40"
            >
              {pendingIds.length > 0 && pendingIds.every((id) => selected.has(id)) ? 'Clear pending' : 'Select pending'}
            </button>
            <Link href="/scorecard" className="inline-flex items-center gap-1 rounded-lg bg-white/70 px-3 py-2 text-xs font-semibold text-blue-600 hover:bg-white">
              Open scorecard
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </div>
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
                <td className="px-4 py-3">
                  <span
                    className={`rounded-full px-2 py-1 text-xs font-semibold ${
                      suggestion.status === 'pending'
                        ? 'bg-red-100 text-red-700'
                        : suggestion.status === 'approved'
                          ? 'bg-emerald-100 text-emerald-700'
                          : 'bg-gray-100 text-gray-600'
                    }`}
                  >
                    {suggestion.status}
                  </span>
                </td>
              </tr>
            ))}
            {suggestions.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-16 text-center">
                  <Sparkles className="mx-auto mb-3 h-9 w-9 text-gray-300" />
                  <p className="text-sm font-semibold text-gray-700">No suggestions yet</p>
                  <p className="mx-auto mt-1 max-w-md text-xs leading-relaxed text-gray-400">
                    Suggestions are created after a run with discrepancies. If you ran tests before this feature shipped,
                    click Generate missing to backfill suggestions for existing runs.
                  </p>
                  <button onClick={generateMissing} className="mt-5 inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white">
                    <RefreshCw className="h-4 w-4" />
                    Generate suggestions
                  </button>
                  <Link href="/runs" className="ml-2 mt-5 inline-flex items-center gap-2 rounded-lg bg-white/70 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-white">
                    Open runs
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </main>
  )
}
