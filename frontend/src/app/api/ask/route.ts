import { NextRequest, NextResponse } from 'next/server'
import { getCurrentAuth, getDataScope } from '@/lib/auth'
import { getDiscrepanciesForScope, getWorkflowAnalytics, logAiAudit } from '@/lib/db'
import { formatCurrency } from '@/lib/utils'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  const { question } = (await request.json()) as { question?: string }
  const q = (question ?? '').trim()
  if (!q) return NextResponse.json({ error: 'Ask a question first' }, { status: 400 })
  if (q.length > 500) return NextResponse.json({ error: 'Question is too long' }, { status: 400 })

  const auth = getCurrentAuth()
  const lower = q.toLowerCase()
  const rows = await getDiscrepanciesForScope(getDataScope(), 1000)
  const analytics = await getWorkflowAnalytics(getDataScope())
  let filtered = rows

  const amountMatch = lower.match(/(?:over|above|greater than|>\s*)\$?(\d+(?:\.\d+)?)/)
  if (amountMatch) {
    const min = Number(amountMatch[1])
    filtered = filtered.filter((row) => Number(row.amount_at_risk) > min)
  }
  if (lower.includes('open')) filtered = filtered.filter((row) => (row.status ?? 'open') === 'open')
  if (lower.includes('resolved')) filtered = filtered.filter((row) => row.status === 'resolved')
  if (lower.includes('assigned to')) {
    const assignee = lower.split('assigned to')[1]?.trim().split(/\s+/)[0]
    if (assignee) filtered = filtered.filter((row) => row.assigned_to?.toLowerCase().includes(assignee))
  }
  for (const type of [
    'rate_mismatch',
    'plan_mismatch',
    'missing_from_billing',
    'missing_from_charges',
    'closed_account_billed',
    'duplicate_invoice',
  ]) {
    if (lower.includes(type.replaceAll('_', ' ')) || lower.includes(type)) {
      filtered = filtered.filter((row) => row.type === type)
    }
  }
  if (lower.includes('flowpay')) filtered = filtered.filter((row) => row.product_line?.toLowerCase().includes('flowpay'))

  const total = filtered.reduce((sum, row) => sum + Number(row.amount_at_risk), 0)
  const top = filtered.slice(0, 10).map((row) => ({
    id: row.id,
    runId: row.run_id,
    merchant: row.merchant_name,
    type: row.type,
    status: row.status ?? 'open',
    assignedTo: row.assigned_to,
    productLine: row.product_line,
    amountAtRisk: Number(row.amount_at_risk),
  }))

  const answer =
    lower.includes('report') || lower.includes('insight')
      ? `Monthly insight: ${formatCurrency(analytics.totalAtRisk)} is currently at risk across ${rows.length} discrepancies. ${analytics.resolutionRate}% are resolved, ${analytics.overdue} are overdue, and the top root cause is ${topRootCause(analytics.rootCauseCounts)}. Corrected resolutions account for ${formatCurrency(analytics.recovered)} in recovered revenue.`
      : `I found ${filtered.length} matching discrepancies totaling ${formatCurrency(total)}. The table includes the top ${top.length} by amount at risk.`

  await logAiAudit({
    event: 'natural_language_query',
    userId: auth.userId,
    orgId: auth.orgId,
    prompt: q,
    inputSummary: { question_length: q.length },
    outputSummary: {
      matched_rows: filtered.length,
      returned_rows: top.length,
      total_at_risk: total,
      parser: 'deterministic_guarded_v1',
    },
    status: 'ok',
  })

  return NextResponse.json({
    answer,
    structuredQuery: {
      amountGreaterThan: amountMatch ? Number(amountMatch[1]) : null,
      status: lower.includes('open') ? 'open' : lower.includes('resolved') ? 'resolved' : null,
      productHint: lower.includes('flowpay') ? 'FlowPay' : null,
    },
    rows: top,
  })
}

function topRootCause(counts: Record<string, number>): string {
  const [label] = Object.entries(counts).sort(([, a], [, b]) => b - a)[0] ?? ['unclassified', 0]
  return label.replaceAll('_', ' ')
}
