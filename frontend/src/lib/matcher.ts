import {
  Discrepancy,
  DiscrepancySeverity,
  MatchResult,
  NormalizedRecord,
} from '@/types'
import { v4 as uuidv4 } from 'uuid'

const AMOUNT_TOLERANCE = 0.02

// ── Severity ──────────────────────────────────────────────────────────────────

function severity(amount: number): DiscrepancySeverity {
  if (amount >= 500) return 'critical'
  if (amount >= 100) return 'high'
  if (amount >= 25) return 'medium'
  return 'low'
}

// ── Period helpers ────────────────────────────────────────────────────────────

function periodsMatch(a: string, b: string): boolean {
  const norm = (s: string) => s.substring(0, 7)
  return norm(a) === norm(b)
}

function periodKey(value: string): string {
  return (value || '').substring(0, 7)
}

// ── Fee type helpers ──────────────────────────────────────────────────────────

function feeTypesMatch(a: string, b: string): boolean {
  if (!a || !b) return false
  const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '')
  const na = norm(a)
  const nb = norm(b)
  return na === nb || na.includes(nb) || nb.includes(na)
}

function normalizeFeeType(value: string): string {
  return (value || '').toLowerCase().replace(/[^a-z0-9]/g, '')
}

function productLinesMatch(a: string, b: string): boolean {
  if (!a || !b) return false
  const norm = (s: string) => s.toLowerCase().replace(/[^a-z]/g, '')
  return norm(a) === norm(b) || norm(a).includes(norm(b)) || norm(b).includes(norm(a))
}

function normalizeProductLine(value: string): string {
  return (value || '').toLowerCase().replace(/[^a-z]/g, '')
}

function invoiceBucketKeys(record: NormalizedRecord): string[] {
  const merchant = record.client_id || '_'
  const period = periodKey(record.billing_period)
  const product = normalizeProductLine(record.product_line)
  const fee = normalizeFeeType(record.fee_type)
  return [
    `${merchant}|${period}|${product}|${fee}`,
    `${merchant}|${period}|${product}|*`,
    `${merchant}|${period}|*|${fee}`,
    `${merchant}|${period}|*|*`,
  ]
}

function chargeBucketKeys(record: NormalizedRecord): string[] {
  return invoiceBucketKeys(record)
}

// ── Core matching ─────────────────────────────────────────────────────────────

export interface ExactMatchResult {
  matches: MatchResult[]
  unmatchedCharges: NormalizedRecord[]
  unmatchedInvoices: NormalizedRecord[]
  /** Pairs where merchant+period+product match but amounts differ */
  amountMismatchPairs: { charge: NormalizedRecord; invoice: NormalizedRecord }[]
}

/**
 * Primary match strategy: merchant_id + product_line/fee_type + billing_period.
 *
 * This is stronger than amount-based matching because in real billing data
 * the amount is exactly what's in dispute — we can't use it to confirm a match.
 * Two records for the same merchant + same product + same period are almost
 * certainly the same charge event, even if the amounts differ.
 */
export function runExactMatch(
  charges: NormalizedRecord[],
  invoices: NormalizedRecord[]
): ExactMatchResult {
  const matches: MatchResult[] = []
  const amountMismatchPairs: { charge: NormalizedRecord; invoice: NormalizedRecord }[] = []
  const usedInvoiceIndices = new Set<number>()
  const unmatchedCharges: NormalizedRecord[] = []
  const invoiceIndex = new Map<string, number[]>()

  invoices.forEach((invoice, index) => {
    for (const key of invoiceBucketKeys(invoice)) {
      const bucket = invoiceIndex.get(key)
      if (bucket) bucket.push(index)
      else invoiceIndex.set(key, [index])
    }
  })

  for (const charge of charges) {
    let bestInvoiceIdx = -1
    let bestScore = 0
    const candidateIndices = new Set<number>()
    for (const key of chargeBucketKeys(charge)) {
      const bucket = invoiceIndex.get(key)
      if (bucket) bucket.forEach((idx) => candidateIndices.add(idx))
    }

    for (const i of candidateIndices) {
      if (usedInvoiceIndices.has(i)) continue
      const inv = invoices[i]

      // Merchant ID must match exactly (it's a system identifier)
      if (charge.client_id && inv.client_id && charge.client_id !== inv.client_id) continue
      // Period must overlap
      if (!periodsMatch(charge.billing_period, inv.billing_period)) continue

      // Score on product/fee type similarity
      let score = 0
      if (feeTypesMatch(charge.fee_type, inv.fee_type)) score += 3
      if (productLinesMatch(charge.product_line, inv.product_line)) score += 2
      if (Math.abs(charge.amount - inv.amount) <= AMOUNT_TOLERANCE) score += 2

      if (score > bestScore) {
        bestScore = score
        bestInvoiceIdx = i
        if (score >= 7) break
      }
    }

    // Need at least merchant+period+product match (score >= 2) to count
    if (bestInvoiceIdx >= 0 && bestScore >= 2) {
      const inv = invoices[bestInvoiceIdx]
      usedInvoiceIndices.add(bestInvoiceIdx)

      const amountDiff = Math.abs(charge.amount - inv.amount)
      if (amountDiff > AMOUNT_TOLERANCE) {
        // Same record, different amount — track separately for mismatch reporting
        amountMismatchPairs.push({ charge, invoice: inv })
        matches.push({
          chargesRecord: charge,
          invoicesRecord: inv,
          matchType: 'exact',
          confidenceScore: 0.95,
        })
      } else {
        matches.push({
          chargesRecord: charge,
          invoicesRecord: inv,
          matchType: 'exact',
          confidenceScore: 1.0,
        })
      }
    } else {
      unmatchedCharges.push(charge)
    }
  }

  const unmatchedInvoices = invoices.filter((_, i) => !usedInvoiceIndices.has(i))

  return { matches, unmatchedCharges, unmatchedInvoices, amountMismatchPairs }
}

// ── Discrepancy building ──────────────────────────────────────────────────────

export function buildDiscrepanciesFromUnmatched(
  unmatchedCharges: NormalizedRecord[],
  unmatchedInvoices: NormalizedRecord[],
  amountMismatchPairs: { charge: NormalizedRecord; invoice: NormalizedRecord }[]
): Discrepancy[] {
  const discrepancies: Discrepancy[] = []

  for (const charge of unmatchedCharges) {
    discrepancies.push({
      id: uuidv4(),
      type: 'missing_from_billing',
      severity: severity(charge.amount),
      amountAtRisk: charge.amount,
      direction: 'under_billed',
      chargesRecord: charge,
      invoicesRecord: null,
      feeScheduleRecord: null,
      confidenceScore: 1.0,
      aiReason: `${charge.product_name} (${charge.fee_type}) for merchant ${charge.client_name} exists in the product/account system but no corresponding invoice was found in the billing file for this period.`,
      rootCause: 'Fee recorded in account management system but billing engine never received the provisioning signal — common with add-on products enrolled outside the standard onboarding flow',
      productLine: charge.product_line,
      merchantId: charge.client_id,
      merchantName: charge.client_name,
    })
  }

  for (const invoice of unmatchedInvoices) {
    const isClosedAccount =
      invoice.account_status?.toLowerCase().includes('closed') ||
      invoice.client_name?.toLowerCase().includes('closed')

    discrepancies.push({
      id: uuidv4(),
      type: isClosedAccount ? 'closed_account_billed' : 'missing_from_charges',
      severity: severity(invoice.amount),
      amountAtRisk: invoice.amount,
      direction: 'over_billed',
      chargesRecord: null,
      invoicesRecord: invoice,
      feeScheduleRecord: null,
      confidenceScore: 1.0,
      aiReason: isClosedAccount
        ? `Invoice issued to ${invoice.client_name} for ${invoice.product_name} but this merchant account was deactivated. Billing system was not notified of the account closure.`
        : `Invoice for ${invoice.product_name} (${invoice.fee_type}) exists in the billing system for MID ${invoice.client_id} but has no corresponding charge record — possible phantom billing, duplicate account, or data entry error.`,
      rootCause: isClosedAccount
        ? 'Account deactivation in platform did not trigger billing system deactivation — systems are not in sync on account lifecycle events'
        : 'Invoice present in billing with no source charge — investigate for duplicate MID, manual billing entry, or data sync failure',
      productLine: invoice.product_line,
      merchantId: invoice.client_id,
      merchantName: invoice.client_name,
    })
  }

  for (const { charge, invoice } of amountMismatchPairs) {
    const diff = invoice.amount - charge.amount
    discrepancies.push({
      id: uuidv4(),
      type: 'amount_mismatch',
      severity: severity(Math.abs(diff)),
      amountAtRisk: Math.abs(diff),
      direction: diff > 0 ? 'over_billed' : 'under_billed',
      chargesRecord: charge,
      invoicesRecord: invoice,
      feeScheduleRecord: null,
      confidenceScore: 0.95,
      aiReason: `${charge.product_name} for ${charge.client_name}: charged $${charge.amount.toFixed(2)}, invoiced $${invoice.amount.toFixed(2)} — difference of $${Math.abs(diff).toFixed(2)}.`,
      rootCause: 'Amount discrepancy between product system and billing engine — check for pro-ration logic differences, manual overrides, or rounding rules',
      productLine: charge.product_line,
      merchantId: charge.client_id,
      merchantName: charge.client_name,
    })
  }

  return discrepancies
}

// ── Merchant + product line summaries ────────────────────────────────────────

export function buildMerchantSummaries(
  discrepancies: Discrepancy[],
  charges: NormalizedRecord[],
  invoices: NormalizedRecord[]
) {
  const byMerchant = new Map<
    string,
    { name: string; charged: number; billed: number; discrepancies: Discrepancy[] }
  >()

  for (const c of charges) {
    const entry = byMerchant.get(c.client_id) ?? {
      name: c.client_name,
      charged: 0,
      billed: 0,
      discrepancies: [],
    }
    entry.charged += c.amount
    byMerchant.set(c.client_id, entry)
  }

  for (const inv of invoices) {
    const entry = byMerchant.get(inv.client_id) ?? {
      name: inv.client_name,
      charged: 0,
      billed: 0,
      discrepancies: [],
    }
    entry.billed += inv.amount
    byMerchant.set(inv.client_id, entry)
  }

  for (const d of discrepancies) {
    const key = d.merchantId
    const entry = byMerchant.get(key)
    if (entry) entry.discrepancies.push(d)
  }

  return Array.from(byMerchant.entries())
    .map(([merchantId, data]) => ({
      merchantId,
      merchantName: data.name,
      totalCharged: data.charged,
      totalBilled: data.billed,
      totalAtRisk: data.discrepancies.reduce((s, d) => s + d.amountAtRisk, 0),
      discrepancyCount: data.discrepancies.length,
      discrepancies: data.discrepancies,
    }))
    .sort((a, b) => b.totalAtRisk - a.totalAtRisk)
}

export function buildProductLineSummaries(discrepancies: Discrepancy[]) {
  const byLine = new Map<string, { atRisk: number; types: Record<string, number> }>()

  for (const d of discrepancies) {
    const line = d.productLine || 'Unknown'
    const entry = byLine.get(line) ?? { atRisk: 0, types: {} }
    entry.atRisk += d.amountAtRisk
    entry.types[d.type] = (entry.types[d.type] ?? 0) + 1
    byLine.set(line, entry)
  }

  return Array.from(byLine.entries())
    .map(([productLine, data]) => ({
      productLine,
      totalAtRisk: data.atRisk,
      discrepancyCount: Object.values(data.types).reduce((s, n) => s + n, 0),
      types: data.types as Discrepancy['type'] extends string
        ? Record<string, number>
        : never,
    }))
    .sort((a, b) => b.totalAtRisk - a.totalAtRisk)
}
