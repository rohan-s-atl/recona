'use client'

import { useState } from 'react'
import { SummaryCards } from './SummaryCards'
import { DiscrepancyTable } from './DiscrepancyTable'
import { MerchantTable } from './MerchantTable'
import { ProductBreakdown } from './ProductBreakdown'
import { cn } from '@/lib/utils'
import type { ReconciliationResult } from '@/types'
import { Printer } from 'lucide-react'

type ResultTab = 'merchants' | 'discrepancies' | 'products'

interface RunResultViewProps {
  result: ReconciliationResult
  ranAt: string
  chargesFilename: string
  invoicesFilename: string
}

export function RunResultView({ result, ranAt, chargesFilename, invoicesFilename }: RunResultViewProps) {
  const [activeTab, setActiveTab] = useState<ResultTab>('merchants')

  return (
    <div className="space-y-8">
      <div className="flex items-start justify-between print:hidden">
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
        <button
          onClick={() => window.print()}
          className="flex items-center gap-1.5 text-sm font-semibold text-gray-600 glass px-3 py-2 rounded-lg hover:bg-white/70 transition-colors"
        >
          <Printer className="w-4 h-4" />
          Export PDF
        </button>
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

      {result.aiSummary && (
        <div className="glass rounded-2xl p-6 print:bg-white print:border print:border-gray-200">
          <p className="text-xs font-semibold text-blue-600 uppercase tracking-wide mb-3 print:text-gray-600">
            AI Executive Summary
          </p>
          <p className="text-sm text-gray-700 leading-relaxed">{result.aiSummary}</p>
        </div>
      )}

      {/* Tabs - hidden in print (all sections show) */}
      <div className="flex items-center gap-1 border-b border-white/60 print:hidden">
        {(
          [
            { id: 'merchants' as ResultTab, label: `By Merchant (${result.merchantSummaries.length})` },
            { id: 'discrepancies' as ResultTab, label: `All Issues (${result.discrepancyCount})` },
            { id: 'products' as ResultTab, label: `By Product Line (${result.productLineSummaries.length})` },
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

      {/* Screen: only active tab. Print: all three sections. */}
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
  )
}
