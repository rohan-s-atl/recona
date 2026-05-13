import { notFound } from 'next/navigation'
import Link from 'next/link'
import { getRunById } from '@/lib/db'
import { isSupabaseConfigured } from '@/lib/supabase'
import { getDataScope } from '@/lib/auth'
import { RunResultView } from '@/components/RunResultView'
import type { Discrepancy, DiscrepancyType, DiscrepancySeverity, MerchantSummary, ProductLineSummary, ReconciliationResult } from '@/types'
import type { DbDiscrepancy } from '@/lib/db'
import { ArrowLeft } from 'lucide-react'

export const dynamic = 'force-dynamic'

function dbDiscrepancyToFrontend(d: DbDiscrepancy): Discrepancy {
  return {
    id: d.id,
    type: d.type as DiscrepancyType,
    severity: d.severity as DiscrepancySeverity,
    amountAtRisk: Number(d.amount_at_risk),
    direction: d.direction as Discrepancy['direction'],
    merchantId: d.merchant_id,
    merchantName: d.merchant_name,
    productLine: d.product_line ?? '',
    aiReason: d.ai_reason ?? '',
    rootCause: d.root_cause ?? '',
    confidenceScore: d.confidence_score ?? 1,
    chargesRecord: d.charges_record as Discrepancy['chargesRecord'],
    invoicesRecord: d.invoices_record as Discrepancy['invoicesRecord'],
    feeScheduleRecord: d.fee_schedule_record as Discrepancy['feeScheduleRecord'],
  }
}

export default async function RunDetailPage({ params }: { params: { id: string } }) {
  if (!isSupabaseConfigured()) {
    return (
      <main className="max-w-4xl mx-auto px-6 py-20 text-center">
        <p className="text-gray-500 font-medium">Database not configured</p>
        <p className="text-sm text-gray-400 mt-2">
          Set your Supabase environment variables to enable run persistence.
        </p>
        <Link href="/runs" className="mt-6 inline-flex text-sm text-blue-600 hover:underline">
          ← Back to runs
        </Link>
      </main>
    )
  }

  const run = await getRunById(params.id, getDataScope())
  if (!run) notFound()

  const discrepancies = run.discrepancies.map(dbDiscrepancyToFrontend)

  // Merchant and product summaries are stored as JSON blobs — cast directly
  const merchantSummaries = (run.merchant_summaries as MerchantSummary[] | null) ?? []
  const productLineSummaries = (run.product_line_summaries as ProductLineSummary[] | null) ?? []

  // Re-hydrate merchantSummaries.discrepancies from the discrepancies array since
  // the JSONB blob stores them with the same shape
  const hydratedMerchants: MerchantSummary[] = merchantSummaries.map((m) => ({
    ...m,
    discrepancies: discrepancies.filter((d) => d.merchantId === m.merchantId),
  }))

  const result: ReconciliationResult = {
    runId: run.id,
    ranAt: run.created_at,
    totalChargesRecords: run.total_charges_records,
    totalInvoicesRecords: run.total_invoices_records,
    hasFeeSchedule: run.has_fee_schedule,
    exactMatches: run.exact_matches,
    fuzzyMatches: run.fuzzy_matches,
    discrepancyCount: run.discrepancy_count,
    totalAmountAtRisk: Number(run.total_amount_at_risk),
    totalOverbilled: Number(run.total_overbilled),
    totalUnderbilled: Number(run.total_underbilled),
    matches: [],
    discrepancies,
    merchantSummaries: hydratedMerchants,
    productLineSummaries,
    aiSummary: run.ai_summary ?? '',
  }

  return (
    <main className="max-w-6xl mx-auto px-6 py-10">
      <div className="mb-8 print:hidden">
        <Link
          href="/runs"
          className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-900 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          All runs
        </Link>
        <h1 className="text-2xl font-bold text-gray-900 mt-3">Reconciliation run</h1>
      </div>

      <RunResultView
        result={result}
        ranAt={run.created_at}
        chargesFilename={run.charges_filename}
        invoicesFilename={run.invoices_filename}
      />
    </main>
  )
}
