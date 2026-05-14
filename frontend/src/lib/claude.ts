import Anthropic from '@anthropic-ai/sdk'
import { ColumnMapping, NormalizedRecord } from '@/types'
import { logAiAudit } from './db'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

const FAST_MODEL = 'claude-haiku-4-5-20251001'
const SMART_MODEL = 'claude-sonnet-4-6'

function logAiCall(event: string, data: Record<string, unknown>) {
  console.info('[ai]', JSON.stringify({ event, at: new Date().toISOString(), ...data }))
}

// ── Column mapping ────────────────────────────────────────────────────────────

export async function inferColumnMapping(
  headers: string[],
  sampleRows: Record<string, string>[]
): Promise<ColumnMapping> {
  const sample = sampleRows.slice(0, 5)

  const prompt = `You are analyzing a financial billing data file for a payment processing company (similar to Fiserv, Square, or Stripe).

Based on the headers and sample rows below, map each field in our unified schema to the exact column name from the file.

Headers: ${JSON.stringify(headers)}

Sample rows:
${JSON.stringify(sample, null, 2)}

Map to these fields (use null if not present):
- record_id: unique row identifier (invoice number, charge ID, etc.)
- client_id: merchant ID / account ID / MID (system identifier, NOT the name)
- client_name: merchant business name or DBA
- product_line: product family/line (e.g. "Apex POS", "FlowPay", "ShieldNet")
- product_name: specific product/plan name (e.g. "Apex POS Core", "FlowPay Processing")
- fee_type: type of fee (e.g. "Monthly Platform Fee", "Processing Fee", "PCI Compliance Fee")
- amount: monetary amount charged or invoiced
- billing_period: billing month/period (e.g. "2024-01", "January 2024")
- date: transaction or invoice date
- transaction_volume: gross transaction volume (only in processing fee rows, usually null otherwise)
- account_status: merchant account status (Active, Closed, etc.) — often not present

Respond with ONLY valid JSON, no explanation:
{"record_id":null,"client_id":"...","client_name":"...","product_line":"...","product_name":"...","fee_type":"...","amount":"...","billing_period":"...","date":"...","transaction_volume":null,"account_status":null}`

  const startedAt = Date.now()
  const response = await client.messages.create({
    model: FAST_MODEL,
    max_tokens: 512,
    messages: [{ role: 'user', content: prompt }],
  })
  logAiCall('column_mapping', {
    model: FAST_MODEL,
    header_count: headers.length,
    sample_rows: sample.length,
    latency_ms: Date.now() - startedAt,
  })
  await logAiAudit({
    event: 'column_mapping',
    model: FAST_MODEL,
    prompt,
    inputSummary: { header_count: headers.length, sample_rows: sample.length },
    outputSummary: { content_type: response.content[0].type },
    latencyMs: Date.now() - startedAt,
  })

  const text = response.content[0].type === 'text' ? response.content[0].text : ''

  try {
    const raw = JSON.parse(text.trim())
    return {
      record_id: raw.record_id ?? null,
      client_id: raw.client_id ?? null,
      client_name: raw.client_name ?? null,
      product_line: raw.product_line ?? null,
      product_name: raw.product_name ?? null,
      fee_type: raw.fee_type ?? null,
      amount: raw.amount ?? null,
      billing_period: raw.billing_period ?? null,
      date: raw.date ?? null,
      transaction_volume: raw.transaction_volume ?? null,
      account_status: raw.account_status ?? null,
    }
  } catch {
    const jsonMatch = text.match(/\{[\s\S]*\}/)
    if (jsonMatch) {
      const raw = JSON.parse(jsonMatch[0])
      return {
        record_id: raw.record_id ?? null,
        client_id: raw.client_id ?? null,
        client_name: raw.client_name ?? null,
        product_line: raw.product_line ?? null,
        product_name: raw.product_name ?? null,
        fee_type: raw.fee_type ?? null,
        amount: raw.amount ?? null,
        billing_period: raw.billing_period ?? null,
        date: raw.date ?? null,
        transaction_volume: raw.transaction_volume ?? null,
        account_status: raw.account_status ?? null,
      }
    }
    throw new Error('Claude returned invalid JSON for column mapping')
  }
}

// ── Fuzzy matching ────────────────────────────────────────────────────────────

interface FuzzyCandidate {
  charge: NormalizedRecord
  invoice: NormalizedRecord
}

interface FuzzyDecision {
  isMatch: boolean
  confidence: number
  reason: string
}

export async function batchFuzzyMatch(
  candidates: FuzzyCandidate[]
): Promise<FuzzyDecision[]> {
  if (candidates.length === 0) return []

  const pairs = candidates.map((c, i) => ({
    index: i,
    charge: {
      merchant_id: c.charge.client_id,
      merchant_name: c.charge.client_name,
      product_line: c.charge.product_line,
      product_name: c.charge.product_name,
      fee_type: c.charge.fee_type,
      amount: c.charge.amount,
      billing_period: c.charge.billing_period,
    },
    invoice: {
      merchant_id: c.invoice.client_id,
      merchant_name: c.invoice.client_name,
      product_line: c.invoice.product_line,
      product_name: c.invoice.product_name,
      fee_type: c.invoice.fee_type,
      amount: c.invoice.amount,
      billing_period: c.invoice.billing_period,
    },
  }))

  const prompt = `You are a financial billing reconciliation expert for a payment processing company.

For each pair below, determine whether the charge record and the invoice record refer to the same underlying fee event. Consider:
- Merchant name variations (abbreviations, "LLC" vs none, "Barber Shop" vs "Barbershop", "Co." dropped)
- Product name variations ("Core" vs "Standard", "Analytics" vs "Insights")
- Same merchant ID is strong evidence even with name differences
- Small amount differences may indicate rate or pro-ration errors (still a match, different amounts)

Pairs:
${JSON.stringify(pairs, null, 2)}

Respond with ONLY a JSON array — one object per pair:
[{"index":0,"isMatch":true,"confidence":0.97,"reason":"Same MID and product line, merchant name abbreviated in billing"},...]

Confidence scale:
0.9–1.0 = almost certainly the same event
0.7–0.89 = likely the same, minor discrepancy
0.5–0.69 = possibly same, needs human review
< 0.5 = probably different`

  const startedAt = Date.now()
  const response = await client.messages.create({
    model: FAST_MODEL,
    max_tokens: 2048,
    messages: [{ role: 'user', content: prompt }],
  })
  logAiCall('fuzzy_match_batch', {
    model: FAST_MODEL,
    candidate_count: candidates.length,
    latency_ms: Date.now() - startedAt,
  })
  await logAiAudit({
    event: 'fuzzy_match_batch',
    model: FAST_MODEL,
    prompt,
    inputSummary: { candidate_count: candidates.length },
    outputSummary: { content_type: response.content[0].type },
    latencyMs: Date.now() - startedAt,
  })

  const text = response.content[0].type === 'text' ? response.content[0].text : '[]'

  try {
    const parsed: { index: number; isMatch: boolean; confidence: number; reason: string }[] =
      JSON.parse(text.trim())

    const results: FuzzyDecision[] = candidates.map(() => ({
      isMatch: false,
      confidence: 0,
      reason: 'No decision returned',
    }))
    for (const item of parsed) {
      if (item.index >= 0 && item.index < results.length) {
        results[item.index] = {
          isMatch: item.isMatch,
          confidence: item.confidence,
          reason: item.reason,
        }
      }
    }
    return results
  } catch {
    const jsonMatch = text.match(/\[[\s\S]*\]/)
    if (jsonMatch) return JSON.parse(jsonMatch[0])
    return candidates.map(() => ({ isMatch: false, confidence: 0, reason: 'Parse error' }))
  }
}

// ── Executive summary ─────────────────────────────────────────────────────────

export interface SummaryInput {
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
}

export async function generateExecutiveSummary(data: SummaryInput): Promise<string> {
  const prompt = `You are a financial operations analyst writing a concise executive summary for a billing reconciliation report at a payment processing company (like Fiserv or Square).

Write 4–6 sentences. Be direct, specific, and quantified. Focus on what the finance team must act on first.

Reconciliation data:
- Charge records compared: ${data.totalCharges}
- Invoice records compared: ${data.totalInvoices}
- Exact matches: ${data.exactMatches}
- AI-confirmed matches (name/format variations resolved): ${data.fuzzyMatches}
- Discrepancies requiring action: ${data.discrepancyCount}
- Total revenue at risk: $${data.totalAtRisk.toLocaleString('en-US', { minimumFractionDigits: 2 })}
- Underbilled (revenue leakage): $${data.totalUnderbilled.toFixed(2)}
- Overbilled to merchants: $${data.totalOverbilled.toFixed(2)}
- Fee schedule loaded: ${data.hasFeeSchedule ? 'Yes — rate mismatches checked against contracts' : 'No'}
- Issue breakdown: ${JSON.stringify(data.topDiscrepancyTypes)}
- Merchants with discrepancies: ${data.topMerchantsAffected.join(', ')}
- Product lines affected: ${data.topProductLinesAffected.join(', ')}

Write 4–6 sentences only. No bullet points. No headers.`

  const startedAt = Date.now()
  const response = await client.messages.create({
    model: SMART_MODEL,
    max_tokens: 512,
    messages: [{ role: 'user', content: prompt }],
  })
  logAiCall('executive_summary', {
    model: SMART_MODEL,
    discrepancy_count: data.discrepancyCount,
    latency_ms: Date.now() - startedAt,
  })
  await logAiAudit({
    event: 'executive_summary',
    model: SMART_MODEL,
    prompt,
    inputSummary: {
      discrepancy_count: data.discrepancyCount,
      total_at_risk: data.totalAtRisk,
    },
    outputSummary: { content_type: response.content[0].type },
    latencyMs: Date.now() - startedAt,
  })

  return response.content[0].type === 'text' ? response.content[0].text.trim() : ''
}
