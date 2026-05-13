import {
  Discrepancy,
  DiscrepancySeverity,
  FeeScheduleRecord,
  MatchResult,
  NormalizedRecord,
} from '@/types'
import { v4 as uuidv4 } from 'uuid'

const FLAT_TOLERANCE = 0.02
const PCT_TOLERANCE = 0.001 // 0.1% tolerance on rate comparisons

function severity(amountAtRisk: number): DiscrepancySeverity {
  if (amountAtRisk >= 500) return 'critical'
  if (amountAtRisk >= 100) return 'high'
  if (amountAtRisk >= 25) return 'medium'
  return 'low'
}

/**
 * Parse the fee schedule CSV into typed records.
 * The CSV parser normalises headers to lowercase with underscores.
 */
export function parseFeeSchedule(
  rows: Record<string, string>[]
): FeeScheduleRecord[] {
  return rows
    .filter((r) => r.merchant_id?.trim())
    .map((r) => ({
      merchant_id: r.merchant_id?.trim() ?? '',
      merchant_name: r.merchant_name?.trim() ?? '',
      product_line: r.product_line?.trim() ?? '',
      product_name: r.product_name?.trim() ?? '',
      fee_type: r.fee_type?.trim() ?? '',
      rate_type: (r.rate_type?.trim().toLowerCase() === 'percentage'
        ? 'percentage'
        : 'flat') as 'flat' | 'percentage',
      contracted_rate: parseFloat(r.contracted_rate ?? '0'),
      effective_date: r.effective_date?.trim() ?? '',
    }))
}

/**
 * For each confirmed match (exact or fuzzy), check whether the billed
 * amount aligns with the contracted rate in the fee schedule.
 *
 * Returns discrepancies for rate/plan mismatches found in matched pairs.
 */
export function checkRatesOnMatches(
  matches: MatchResult[],
  schedule: FeeScheduleRecord[]
): Discrepancy[] {
  const discrepancies: Discrepancy[] = []
  const scheduleByMerchant = buildScheduleMerchantIndex(schedule)

  for (const match of matches) {
    const charge = match.chargesRecord
    const invoice = match.invoicesRecord

    const contracted = findContractedFee(charge.client_id, charge.product_name, scheduleByMerchant)
    if (!contracted) continue

    if (contracted.rate_type === 'flat') {
      const diff = invoice.amount - contracted.contracted_rate
      if (Math.abs(diff) > FLAT_TOLERANCE) {
        const isPlanMismatch = isPlanTierMismatch(
          charge.product_name,
          invoice.product_name,
          contracted.product_name
        )

        discrepancies.push({
          id: uuidv4(),
          type: isPlanMismatch ? 'plan_mismatch' : 'amount_mismatch',
          severity: severity(Math.abs(diff)),
          amountAtRisk: Math.abs(diff),
          direction: diff > 0 ? 'over_billed' : 'under_billed',
          chargesRecord: charge,
          invoicesRecord: invoice,
          feeScheduleRecord: contracted,
          confidenceScore: 1.0,
          aiReason: isPlanMismatch
            ? `Merchant contracted for "${contracted.product_name}" ($${contracted.contracted_rate}/mo) but invoiced "${invoice.product_name}" ($${invoice.amount}/mo). Plan tier in billing does not match the signed contract.`
            : `Flat fee billed at $${invoice.amount} does not match contracted rate of $${contracted.contracted_rate}. Difference: $${Math.abs(diff).toFixed(2)}.`,
          rootCause: isPlanMismatch
            ? 'Plan upgrade/downgrade recorded in account system not propagated to billing engine'
            : 'Billing system rate table out of sync with contract management system',
          productLine: charge.product_line,
          merchantId: charge.client_id,
          merchantName: charge.client_name,
        })
      }
    } else {
      // Percentage fee — check if the billed rate matches contracted %
      if (charge.transaction_volume && charge.transaction_volume > 0) {
        const expectedAmount =
          (contracted.contracted_rate / 100) * charge.transaction_volume
        const diff = invoice.amount - expectedAmount

        if (Math.abs(diff) > FLAT_TOLERANCE) {
          const billedRate = (invoice.amount / charge.transaction_volume) * 100
          const rateDiff = billedRate - contracted.contracted_rate

          discrepancies.push({
            id: uuidv4(),
            type: 'rate_mismatch',
            severity: severity(Math.abs(diff)),
            amountAtRisk: Math.abs(diff),
            direction: diff > 0 ? 'over_billed' : 'under_billed',
            chargesRecord: charge,
            invoicesRecord: invoice,
            feeScheduleRecord: contracted,
            confidenceScore: 1.0,
            aiReason: `Processing fee billed at ${billedRate.toFixed(2)}% ($${invoice.amount.toFixed(2)}) on volume of $${charge.transaction_volume.toLocaleString()}. Contracted rate is ${contracted.contracted_rate}% — expected $${expectedAmount.toFixed(2)}. Overcharge: $${Math.abs(diff).toFixed(2)}.`,
            rootCause:
              'Merchant processing rate in billing engine does not match rate on signed merchant agreement — likely a MID provisioning error',
            productLine: charge.product_line,
            merchantId: charge.client_id,
            merchantName: charge.client_name,
          })
        }
      }
    }
  }

  return discrepancies
}

/**
 * Scan the fee schedule for contracted fees that are completely absent
 * from the billing file for the period — these are silent revenue leaks
 * that no amount of charge-vs-invoice matching will catch.
 */
export function findMissingContractedFees(
  schedule: FeeScheduleRecord[],
  invoices: NormalizedRecord[],
  billingPeriod: string
): Discrepancy[] {
  const discrepancies: Discrepancy[] = []
  const invoicesByMerchantPeriod = buildInvoiceMerchantPeriodIndex(invoices)
  const normalizedBillingPeriod = normalizeBillingPeriod(billingPeriod)

  for (const fee of schedule) {
    const matchingInvoices = invoicesByMerchantPeriod
      .get(merchantPeriodKey(fee.merchant_id, normalizedBillingPeriod))
      ?.filter((inv) => productLinesMatch(inv.product_line, fee.product_line)) ?? []

    if (matchingInvoices.length === 0) {
      const feeAmount =
        fee.rate_type === 'flat'
          ? fee.contracted_rate
          : 0 // can't know amount without volume for % fees

      discrepancies.push({
        id: uuidv4(),
        type: 'missing_contracted_fee',
        severity: severity(feeAmount || 15), // assume at least medium if % fee
        amountAtRisk: feeAmount,
        direction: 'under_billed',
        chargesRecord: null,
        invoicesRecord: null,
        feeScheduleRecord: fee,
        confidenceScore: 1.0,
        aiReason: `"${fee.product_name}" (${fee.fee_type}) is in the signed merchant contract for MID ${fee.merchant_id} but does not appear anywhere in the billing file for this period.`,
        rootCause:
          'Product enrolled in account/CRM system but provisioning step to billing engine was never completed — common with add-on products',
        productLine: fee.product_line,
        merchantId: fee.merchant_id,
        merchantName: fee.merchant_name,
      })
    }
  }

  return discrepancies
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function buildScheduleMerchantIndex(schedule: FeeScheduleRecord[]): Map<string, FeeScheduleRecord[]> {
  const index = new Map<string, FeeScheduleRecord[]>()
  for (const fee of schedule) {
    const bucket = index.get(fee.merchant_id)
    if (bucket) {
      bucket.push(fee)
    } else {
      index.set(fee.merchant_id, [fee])
    }
  }
  return index
}

function buildInvoiceMerchantPeriodIndex(invoices: NormalizedRecord[]): Map<string, NormalizedRecord[]> {
  const index = new Map<string, NormalizedRecord[]>()
  for (const invoice of invoices) {
    const key = merchantPeriodKey(invoice.client_id, normalizeBillingPeriod(invoice.billing_period))
    const bucket = index.get(key)
    if (bucket) {
      bucket.push(invoice)
    } else {
      index.set(key, [invoice])
    }
  }
  return index
}

function merchantPeriodKey(merchantId: string, billingPeriod: string): string {
  return `${merchantId}|${billingPeriod}`
}

function findContractedFee(
  merchantId: string,
  productName: string,
  scheduleByMerchant: Map<string, FeeScheduleRecord[]>
): FeeScheduleRecord | undefined {
  return scheduleByMerchant.get(merchantId)?.find(
    (s) =>
      productNamesMatch(s.product_name, productName)
  )
}

function productNamesMatch(a: string, b: string): boolean {
  const norm = (s: string) =>
    s.toLowerCase().replace(/[^a-z0-9]/g, '').trim()
  return norm(a) === norm(b) || norm(a).includes(norm(b)) || norm(b).includes(norm(a))
}

function productLinesMatch(a: string, b: string): boolean {
  const norm = (s: string) => s.toLowerCase().replace(/\s+/g, '')
  return norm(a) === norm(b) || norm(a).includes(norm(b)) || norm(b).includes(norm(a))
}

function normalizeBillingPeriod(value: string): string {
  return value.substring(0, 7)
}

function isPlanTierMismatch(
  chargeProductName: string,
  invoiceProductName: string,
  contractedProductName: string
): boolean {
  const tiers = ['lite', 'starter', 'core', 'standard', 'pro', 'advanced', 'enterprise']
  const getTier = (name: string) =>
    tiers.find((t) => name.toLowerCase().includes(t)) ?? null

  const contractedTier = getTier(contractedProductName)
  const billedTier = getTier(invoiceProductName)

  return contractedTier !== null && billedTier !== null && contractedTier !== billedTier
}
