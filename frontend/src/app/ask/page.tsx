'use client'

import Link from 'next/link'
import { useState } from 'react'
import { formatCurrency } from '@/lib/utils'
import { Send } from 'lucide-react'

interface AskRow {
  id: string
  runId: string
  merchant: string
  type: string
  status: string
  assignedTo: string | null
  productLine: string | null
  amountAtRisk: number
}

export default function AskPage() {
  const [question, setQuestion] = useState('Show me all open discrepancies over $200')
  const [answer, setAnswer] = useState('')
  const [rows, setRows] = useState<AskRow[]>([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function ask() {
    setBusy(true)
    setError(null)
    try {
      const response = await fetch('/api/ask', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question }),
      })
      const json = await response.json()
      if (!response.ok) throw new Error(json.error ?? 'Question failed')
      setAnswer(json.answer)
      setRows(json.rows)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Question failed')
    } finally {
      setBusy(false)
    }
  }

  return (
    <main className="mx-auto max-w-[1400px] px-6 py-7 lg:px-10">
      <div className="mb-5">
        <p className="text-xs font-semibold uppercase tracking-wide text-blue-600">Natural language Q&A</p>
        <h1 className="mt-1 text-3xl font-bold text-gray-900">Ask Recona</h1>
        <p className="mt-1 text-[15px] text-gray-500">Query reconciliation data in plain English.</p>
      </div>

      <div className="glass rounded-xl p-4">
        <div className="flex gap-3">
          <input
            value={question}
            onChange={(event) => setQuestion(event.target.value)}
            className="min-w-0 flex-1 rounded-lg border border-white/70 bg-white/75 px-4 py-3 text-sm font-medium text-gray-900 outline-none"
            placeholder="Which merchants have had rate mismatches over $500?"
          />
          <button
            onClick={ask}
            disabled={busy || !question.trim()}
            className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-3 text-sm font-semibold text-white shadow-md shadow-blue-500/20 disabled:opacity-40"
          >
            <Send className="h-4 w-4" />
            Ask
          </button>
        </div>
        {error && <p className="mt-3 text-sm font-semibold text-red-600">{error}</p>}
        {answer && <p className="mt-4 text-sm leading-relaxed text-gray-700">{answer}</p>}
      </div>

      {rows.length > 0 && (
        <div className="glass mt-5 overflow-hidden rounded-xl">
          <div className="border-b border-white/60 px-4 py-3">
            <p className="text-sm font-semibold text-gray-900">Supporting data</p>
            <p className="text-xs text-gray-400">Top matches by amount at risk</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/60 text-xs font-semibold uppercase tracking-wide text-gray-400">
                  <th className="px-4 py-3 text-left">Merchant</th>
                  <th className="px-4 py-3 text-left">Type</th>
                  <th className="px-4 py-3 text-left">Status</th>
                  <th className="px-4 py-3 text-left">Owner</th>
                  <th className="px-4 py-3 text-right">At risk</th>
                  <th className="px-4 py-3 text-right">Run</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/50">
                {rows.map((row) => (
                  <tr key={row.id} className="hover:bg-white/40">
                    <td className="px-4 py-3 font-semibold text-gray-900">{row.merchant}</td>
                    <td className="px-4 py-3 text-gray-600">{row.type.replaceAll('_', ' ')}</td>
                    <td className="px-4 py-3 text-gray-600">{row.status.replaceAll('_', ' ')}</td>
                    <td className="px-4 py-3 text-gray-500">{row.assignedTo ?? '-'}</td>
                    <td className="px-4 py-3 text-right font-bold text-red-600">{formatCurrency(row.amountAtRisk)}</td>
                    <td className="px-4 py-3 text-right">
                      <Link href={`/runs/${row.runId}`} className="text-xs font-semibold text-blue-600">
                        Open
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </main>
  )
}
