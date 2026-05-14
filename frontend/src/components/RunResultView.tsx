'use client'

import { useState } from 'react'
import { SummaryCards } from './SummaryCards'
import { DiscrepancyTable } from './DiscrepancyTable'
import { MerchantTable } from './MerchantTable'
import { ProductBreakdown } from './ProductBreakdown'
import { BarList, DonutChart, currencyFormatter } from './OperationalCharts'
import { cn } from '@/lib/utils'
import type { ReconciliationResult } from '@/types'
import { ArrowRight, CheckCircle2, Inbox, Link as LinkIcon, Printer, Sparkles } from 'lucide-react'

type ResultTab = 'merchants' | 'discrepancies' | 'products'

interface RunResultViewProps {
  result: ReconciliationResult
  ranAt: string
  chargesFilename: string
  invoicesFilename: string
}

export function RunResultView({ result, ranAt, chargesFilename, invoicesFilename }: RunResultViewProps) {
  const [activeTab, setActiveTab] = useState<ResultTab>('merchants')
  const totalMatched = result.exactMatches + result.fuzzyMatches
  const matchBase = Math.max(result.totalChargesRecords, result.totalInvoicesRecords, 1)
  const matchRate = Math.round((totalMatched / matchBase) * 100)
  const assignedCount = result.discrepancies.filter((discrepancy) => discrepancy.assignedTo && discrepancy.status !== 'resolved').length
  const resolvedCount = result.discrepancies.filter((discrepancy) => discrepancy.status === 'resolved').length
  const issueMix = Object.entries(
    result.discrepancies.reduce<Record<string, number>>((acc, discrepancy) => {
      acc[discrepancy.type] = (acc[discrepancy.type] ?? 0) + 1
      return acc
    }, {})
  )
    .sort(([, a], [, b]) => b - a)
    .slice(0, 6)
    .map(([label, value]) => ({
      label: TYPE_LABEL[label] ?? label,
      value,
      colorClass: ISSUE_BAR_COLOR[label] ?? 'bg-gray-400',
    }))
  const topProductExposure = result.productLineSummaries.slice(0, 6).map((summary) => ({
    label: summary.productLine || 'Unknown',
    sublabel: `${summary.discrepancyCount} issues`,
    value: summary.totalAtRisk,
    colorClass: 'bg-blue-500',
  }))

  async function copyShareLink() {
    const response = await fetch('/api/share-links', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ runId: result.runId }),
    })
    const json = await response.json()
    if (!response.ok) throw new Error(json.error ?? 'Unable to create share link')
    await navigator.clipboard.writeText(`${window.location.origin}${json.urlPath}`)
  }

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-4 print:hidden">
        <div>
          <p className="text-xs text-gray-400 font-mono mt-1">
            Run {result.runId.substring(0, 8)} - {new Date(ranAt).toLocaleString()}
          </p>
          <p className="text-xs text-gray-400 mt-0.5">
            {chargesFilename} x {invoicesFilename}
            {result.hasFeeSchedule && (
              <span className="ml-2 bg-green-100 text-green-700 text-xs font-semibold px-2 py-0.5 rounded-full">
                Rate check active
              </span>
            )}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => void copyShareLink()}
            className="flex items-center gap-1.5 text-sm font-semibold text-gray-600 glass px-3 py-2 rounded-lg hover:bg-white/70 transition-colors"
          >
            <LinkIcon className="w-4 h-4" />
            Copy share link
          </button>
          <button
            onClick={() => window.print()}
            className="flex items-center gap-1.5 text-sm font-semibold text-gray-600 glass px-3 py-2 rounded-lg hover:bg-white/70 transition-colors"
          >
            <Printer className="w-4 h-4" />
            Export PDF
          </button>
        </div>
      </div>

      {/* Print header - only visible when printing */}
      <div className="hidden print:block print:mb-4">
        <h1 className="text-xl font-bold text-gray-900">Recona - Reconciliation Report</h1>
        <p className="text-xs text-gray-500 mt-1">
          Run {result.runId} - Generated {new Date(ranAt).toLocaleString()}
        </p>
        <p className="text-xs text-gray-500">
          {chargesFilename} x {invoicesFilename}
        </p>
      </div>

      <SummaryCards result={result} />

      {result.discrepancyCount > 0 && (
        <div className="glass rounded-xl p-4 print:hidden">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-gray-900">Exception workflow</p>
              <p className="mt-1 text-xs text-gray-400">
                Assign issues, work them from Queue, approve suggested fixes, then track recovered revenue.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <span className="rounded-full bg-red-100 px-2.5 py-1 text-xs font-bold text-red-700">
                {assignedCount} assigned
              </span>
              <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-bold text-emerald-700">
                {resolvedCount} resolved
              </span>
            </div>
          </div>
          <div className="mt-4 grid gap-3 md:grid-cols-4">
            <button
              onClick={() => setActiveTab('discrepancies')}
              className="rounded-lg bg-white/55 p-3 text-left transition-colors hover:bg-white/75"
            >
              <CheckCircle2 className="mb-2 h-4 w-4 text-blue-600" />
              <p className="text-sm font-semibold text-gray-900">1. Assign issues</p>
              <p className="mt-1 text-xs leading-relaxed text-gray-500">Use the Issues tab, select rows, then assign an owner and due date.</p>
            </button>
            <a href="/queue" className="rounded-lg bg-white/55 p-3 transition-colors hover:bg-white/75">
              <Inbox className="mb-2 h-4 w-4 text-red-600" />
              <p className="text-sm font-semibold text-gray-900">2. Work Queue</p>
              <p className="mt-1 text-xs leading-relaxed text-gray-500">Assigned items land here with a red badge in the top nav.</p>
            </a>
            <a href="/resolutions" className="rounded-lg bg-white/55 p-3 transition-colors hover:bg-white/75">
              <Sparkles className="mb-2 h-4 w-4 text-violet-600" />
              <p className="text-sm font-semibold text-gray-900">3. Approve fixes</p>
              <p className="mt-1 text-xs leading-relaxed text-gray-500">Review generated actions and approve recoveries in bulk.</p>
            </a>
            <a href="/scorecard" className="rounded-lg bg-white/55 p-3 transition-colors hover:bg-white/75">
              <ArrowRight className="mb-2 h-4 w-4 text-emerald-600" />
              <p className="text-sm font-semibold text-gray-900">4. Track impact</p>
              <p className="mt-1 text-xs leading-relaxed text-gray-500">Recovered revenue and reversals roll into the scorecard.</p>
            </a>
          </div>
        </div>
      )}

      <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_410px]">
        <div className="min-w-0 space-y-5">
          {result.aiSummary && (
            <div className="glass rounded-xl p-5 print:bg-white print:border print:border-gray-200">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-blue-600 print:text-gray-600">
                AI Executive Summary
              </p>
              <p className="text-sm leading-relaxed text-gray-700">{result.aiSummary}</p>
            </div>
          )}

          <div className="flex items-center gap-1 border-b border-white/60 print:hidden">
            {(
              [
                { id: 'merchants' as ResultTab, label: `Merchants (${result.merchantSummaries.length})` },
                { id: 'discrepancies' as ResultTab, label: `Issues (${result.discrepancyCount})` },
                { id: 'products' as ResultTab, label: `Products (${result.productLineSummaries.length})` },
              ] as const
            ).map(({ id, label }) => (
              <button
                key={id}
                onClick={() => setActiveTab(id)}
                className={cn(
                  'px-4 py-2.5 text-sm font-semibold border-b-2 -mb-px transition-colors',
                  activeTab === id
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-800'
                )}
              >
                {label}
              </button>
            ))}
          </div>

          <div className={cn(activeTab === 'merchants' ? 'block' : 'hidden', 'print:block')}>
            <p className="hidden print:block text-sm font-bold text-gray-700 mb-3">By Merchant</p>
            <MerchantTable summaries={result.merchantSummaries} />
          </div>

          <div className={cn(activeTab === 'discrepancies' ? 'block' : 'hidden', 'print:block print:mt-8')}>
            <p className="hidden print:block text-sm font-bold text-gray-700 mb-3">All Issues</p>
            <DiscrepancyTable discrepancies={result.discrepancies} />
          </div>

          <div className={cn(activeTab === 'products' ? 'block' : 'hidden', 'print:block print:mt-8')}>
            <p className="hidden print:block text-sm font-bold text-gray-700 mb-3">By Product Line</p>
            <ProductBreakdown summaries={result.productLineSummaries} />
          </div>
        </div>

        <aside className="space-y-3 print:hidden">
          <DonutChart
            title="Risk split"
            subtitle="Finance vs customer-impact exposure"
            centerLabel="Total"
            centerValue={currencyFormatter(result.totalAmountAtRisk)}
            valueFormatter={currencyFormatter}
            segments={[
              { label: 'Underbilled', value: result.totalUnderbilled, color: '#dc2626', textClass: 'text-red-600' },
              { label: 'Overbilled', value: result.totalOverbilled, color: '#f97316', textClass: 'text-orange-600' },
            ]}
          />
          <div className="glass rounded-xl p-4">
            <p className="text-sm font-semibold text-gray-900">Control summary</p>
            <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
              <div>
                <p className="text-xs text-gray-400">Match rate</p>
                <p className="mt-1 font-bold text-emerald-600">{matchRate}%</p>
              </div>
              <div>
                <p className="text-xs text-gray-400">AI matches</p>
                <p className="mt-1 font-bold text-violet-600">{result.fuzzyMatches.toLocaleString()}</p>
              </div>
              <div>
                <p className="text-xs text-gray-400">Charges</p>
                <p className="mt-1 font-bold text-gray-900">{result.totalChargesRecords.toLocaleString()}</p>
              </div>
              <div>
                <p className="text-xs text-gray-400">Invoices</p>
                <p className="mt-1 font-bold text-gray-900">{result.totalInvoicesRecords.toLocaleString()}</p>
              </div>
            </div>
          </div>
          <BarList title="Issue mix" items={issueMix} />
          <BarList title="Product exposure" items={topProductExposure} valueFormatter={currencyFormatter} />
        </aside>
      </div>
    </div>
  )
}

const TYPE_LABEL: Record<string, string> = {
  missing_from_billing: 'Missing invoice',
  missing_from_charges: 'Phantom billing',
  rate_mismatch: 'Rate mismatch',
  plan_mismatch: 'Plan mismatch',
  amount_mismatch: 'Amount mismatch',
  missing_contracted_fee: 'Contract not billed',
  closed_account_billed: 'Closed acct billed',
  proration_error: 'Proration error',
  duplicate_invoice: 'Duplicate invoice',
  name_variation_flagged: 'Needs review',
}

const ISSUE_BAR_COLOR: Record<string, string> = {
  missing_from_billing: 'bg-orange-500',
  missing_from_charges: 'bg-red-500',
  rate_mismatch: 'bg-purple-500',
  plan_mismatch: 'bg-blue-500',
  amount_mismatch: 'bg-amber-500',
  missing_contracted_fee: 'bg-rose-500',
  closed_account_billed: 'bg-gray-500',
  proration_error: 'bg-cyan-500',
  duplicate_invoice: 'bg-yellow-500',
  name_variation_flagged: 'bg-slate-500',
}
