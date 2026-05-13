import { v4 as uuidv4 } from 'uuid'
import { getFile, getFeeSchedule } from '@/lib/fileStore'
import { normalizeRecords } from '@/lib/normalizer'
import {
  buildDiscrepanciesFromUnmatched,
  buildMerchantSummaries,
  buildProductLineSummaries,
  runExactMatch,
} from '@/lib/matcher'
import { checkRatesOnMatches, findMissingContractedFees } from '@/lib/rateChecker'
import { batchFuzzyMatch, generateExecutiveSummary } from '@/lib/claude'
import type { Discrepancy, MatchResult, NormalizedRecord, ReconcileApiRequest, ReconciliationResult } from '@/types'

const FUZZY_BATCH_SIZE = 25
const AUTO_ACCEPT_THRESHOLD = 0.85
const EXECUTIVE_SUMMARY_TIMEOUT_MS = 30000

export type ReconcilePhase = 'parsing' | 'exact_match' | 'fuzzy_match' | 'rate_check' | 'summary' | 'saving'

export interface ReconcileProgress {
  phase: ReconcilePhase
  label: string
  detail?: string
}

export interface EngineResult {
  result: ReconciliationResult
  chargesFilename: string
  invoicesFilename: string
  feeScheduleFilename?: string
}

export async function runReconciliationEngine(
  body: ReconcileApiRequest,
  onProgress: (progress: ReconcileProgress) => void = () => undefined
): Promise<EngineResult> {
  const { chargesFileId, invoicesFileId, chargesMapping, invoicesMapping, feeScheduleFileId } = body

  onProgress({ phase: 'parsing', label: 'Loading files...' })
  const chargesFile = getFile(chargesFileId)
  const invoicesFile = getFile(invoicesFileId)
  if (!chargesFile) throw new Error('Charges file not found - please re-upload')
  if (!invoicesFile) throw new Error('Invoices file not found - please re-upload')

  const feeSchedule = feeScheduleFileId ? getFeeSchedule(feeScheduleFileId) : null
  const chargesRecords = normalizeRecords(chargesFile.parsed.rows, chargesMapping, 'charges')
  const invoicesRecords = normalizeRecords(invoicesFile.parsed.rows, invoicesMapping, 'invoices')

  onProgress({
    phase: 'exact_match',
    label: 'Running exact match...',
    detail: `${chargesRecords.length} charges - ${invoicesRecords.length} invoices`,
  })
  const { matches: exactMatches, unmatchedCharges, unmatchedInvoices, amountMismatchPairs } =
    runExactMatch(chargesRecords, invoicesRecords)

  const fuzzyMatches: MatchResult[] = []
  const stillUnmatchedCharges: NormalizedRecord[] = []
  const stillUnmatchedInvoices: NormalizedRecord[] = []

  if (unmatchedCharges.length > 0 && unmatchedInvoices.length > 0) {
    onProgress({
      phase: 'fuzzy_match',
      label: 'AI fuzzy matching...',
      detail: `${unmatchedCharges.length + unmatchedInvoices.length} unmatched records`,
    })

    const candidates: { chargeIdx: number; invoiceIdx: number }[] = []
    for (let ci = 0; ci < unmatchedCharges.length && candidates.length < FUZZY_BATCH_SIZE; ci++) {
      for (let ii = 0; ii < unmatchedInvoices.length && candidates.length < FUZZY_BATCH_SIZE; ii++) {
        const charge = unmatchedCharges[ci]
        const invoice = unmatchedInvoices[ii]
        if (charge.billing_period.substring(0, 7) === invoice.billing_period.substring(0, 7)) {
          candidates.push({ chargeIdx: ci, invoiceIdx: ii })
        }
      }
    }

    if (candidates.length > 0) {
      const decisions = await batchFuzzyMatch(
        candidates.map((candidate) => ({
          charge: unmatchedCharges[candidate.chargeIdx],
          invoice: unmatchedInvoices[candidate.invoiceIdx],
        }))
      )
      const usedChargeIdx = new Set<number>()
      const usedInvoiceIdx = new Set<number>()

      decisions
        .map((decision, i) => ({ ...decision, ...candidates[i] }))
        .sort((a, b) => b.confidence - a.confidence)
        .forEach((item) => {
          if (
            item.isMatch &&
            item.confidence >= AUTO_ACCEPT_THRESHOLD &&
            !usedChargeIdx.has(item.chargeIdx) &&
            !usedInvoiceIdx.has(item.invoiceIdx)
          ) {
            fuzzyMatches.push({
              chargesRecord: unmatchedCharges[item.chargeIdx],
              invoicesRecord: unmatchedInvoices[item.invoiceIdx],
              matchType: 'fuzzy',
              confidenceScore: item.confidence,
              aiReason: item.reason,
            })
            usedChargeIdx.add(item.chargeIdx)
            usedInvoiceIdx.add(item.invoiceIdx)
          }
        })

      unmatchedCharges.forEach((record, i) => {
        if (!usedChargeIdx.has(i)) stillUnmatchedCharges.push(record)
      })
      unmatchedInvoices.forEach((record, i) => {
        if (!usedInvoiceIdx.has(i)) stillUnmatchedInvoices.push(record)
      })
    } else {
      stillUnmatchedCharges.push(...unmatchedCharges)
      stillUnmatchedInvoices.push(...unmatchedInvoices)
    }
  } else {
    onProgress({ phase: 'fuzzy_match', label: 'AI fuzzy matching...', detail: 'All records matched exactly' })
    stillUnmatchedCharges.push(...unmatchedCharges)
    stillUnmatchedInvoices.push(...unmatchedInvoices)
  }

  const allMatches = [...exactMatches, ...fuzzyMatches]
  const rateDiscrepancies: Discrepancy[] = []
  const missingContractedFees: Discrepancy[] = []

  if (feeSchedule && feeSchedule.records.length > 0) {
    onProgress({
      phase: 'rate_check',
      label: 'Checking rates & plans...',
      detail: `${feeSchedule.records.length} contracted rates`,
    })
    rateDiscrepancies.push(...checkRatesOnMatches(allMatches, feeSchedule.records))
    const allPeriods = [...chargesRecords, ...invoicesRecords].map((record) => record.billing_period).filter(Boolean)
    const dominantPeriod = allPeriods.length > 0 ? mostCommon(allPeriods) : new Date().toISOString().substring(0, 7)
    missingContractedFees.push(...findMissingContractedFees(feeSchedule.records, invoicesRecords, dominantPeriod))
  } else {
    onProgress({ phase: 'rate_check', label: 'Checking rates & plans...', detail: 'No fee schedule uploaded' })
  }

  const allDiscrepancies = deduplicateDiscrepancies([
    ...buildDiscrepanciesFromUnmatched(stillUnmatchedCharges, stillUnmatchedInvoices, amountMismatchPairs),
    ...rateDiscrepancies,
    ...missingContractedFees,
  ])
  const totalAmountAtRisk = allDiscrepancies.reduce((sum, discrepancy) => sum + discrepancy.amountAtRisk, 0)
  const totalUnderbilled = allDiscrepancies
    .filter((d) => d.direction === 'under_billed' || d.direction === 'missing')
    .reduce((sum, discrepancy) => sum + discrepancy.amountAtRisk, 0)
  const totalOverbilled = allDiscrepancies
    .filter((d) => d.direction === 'over_billed')
    .reduce((sum, discrepancy) => sum + discrepancy.amountAtRisk, 0)
  const typeCounts = allDiscrepancies.reduce<Record<string, number>>((acc, discrepancy) => {
    acc[discrepancy.type] = (acc[discrepancy.type] ?? 0) + 1
    return acc
  }, {})
  const merchantSummaries = buildMerchantSummaries(allDiscrepancies, chargesRecords, invoicesRecords)
  const productLineSummaries = buildProductLineSummaries(allDiscrepancies)

  onProgress({
    phase: 'summary',
    label: 'Generating executive summary...',
    detail: `${allDiscrepancies.length} discrepancies found`,
  })
  const summaryInput = {
    totalCharges: chargesRecords.length,
    totalInvoices: invoicesRecords.length,
    exactMatches: exactMatches.length,
    fuzzyMatches: fuzzyMatches.length,
    discrepancyCount: allDiscrepancies.length,
    totalAtRisk: totalAmountAtRisk,
    totalUnderbilled,
    totalOverbilled,
    hasFeeSchedule: !!feeSchedule,
    topDiscrepancyTypes: typeCounts,
    topMerchantsAffected: merchantSummaries.slice(0, 5).map((merchant) => merchant.merchantName),
    topProductLinesAffected: productLineSummaries.slice(0, 5).map((product) => product.productLine),
  }

  const aiSummary = await withTimeout(
    generateExecutiveSummary(summaryInput),
    EXECUTIVE_SUMMARY_TIMEOUT_MS,
    fallbackExecutiveSummary(summaryInput)
  )

  return {
    result: {
      runId: uuidv4(),
      ranAt: new Date().toISOString(),
      totalChargesRecords: chargesRecords.length,
      totalInvoicesRecords: invoicesRecords.length,
      hasFeeSchedule: !!feeSchedule,
      exactMatches: exactMatches.length,
      fuzzyMatches: fuzzyMatches.length,
      discrepancyCount: allDiscrepancies.length,
      totalAmountAtRisk,
      totalOverbilled,
      totalUnderbilled,
      matches: allMatches,
      discrepancies: allDiscrepancies,
      merchantSummaries,
      productLineSummaries,
      aiSummary,
    },
    chargesFilename: chargesFile.filename,
    invoicesFilename: invoicesFile.filename,
    feeScheduleFilename: feeSchedule?.filename,
  }
}

function mostCommon(arr: string[]): string {
  const counts = arr.reduce<Record<string, number>>((acc, value) => {
    acc[value] = (acc[value] ?? 0) + 1
    return acc
  }, {})
  return Object.entries(counts).sort(([, a], [, b]) => b - a)[0]?.[0] ?? arr[0]
}

function deduplicateDiscrepancies(discrepancies: Discrepancy[]): Discrepancy[] {
  const seen = new Set<string>()
  return discrepancies.filter((discrepancy) => {
    const key = `${discrepancy.merchantId}|${discrepancy.productLine}|${discrepancy.type}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number, fallback: T): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined
  try {
    return await Promise.race([
      promise,
      new Promise<T>((resolve) => {
        timer = setTimeout(() => resolve(fallback), timeoutMs)
      }),
    ])
  } finally {
    if (timer) clearTimeout(timer)
  }
}

function fallbackExecutiveSummary(input: {
  totalCharges: number
  totalInvoices: number
  exactMatches: number
  fuzzyMatches: number
  discrepancyCount: number
  totalAtRisk: number
  totalUnderbilled: number
  totalOverbilled: number
  hasFeeSchedule: boolean
  topDiscrepancyTypes: Record<string, number>
  topMerchantsAffected: string[]
  topProductLinesAffected: string[]
}): string {
  const topType = Object.entries(input.topDiscrepancyTypes).sort(([, a], [, b]) => b - a)[0]?.[0] ?? 'discrepancies'
  const feeSchedule = input.hasFeeSchedule ? 'Contracted rates were included in the review.' : 'No fee schedule was included.'

  return [
    `Recona compared ${input.totalCharges.toLocaleString()} charge records against ${input.totalInvoices.toLocaleString()} invoice records.`,
    `${input.exactMatches.toLocaleString()} records matched exactly and ${input.fuzzyMatches.toLocaleString()} matches required AI assistance.`,
    `${input.discrepancyCount.toLocaleString()} discrepancies were found, led by ${topType}, with $${input.totalAtRisk.toFixed(2)} total at risk.`,
    `Underbilled revenue totals $${input.totalUnderbilled.toFixed(2)} and overbilled merchant impact totals $${input.totalOverbilled.toFixed(2)}.`,
    feeSchedule,
  ].join(' ')
}
