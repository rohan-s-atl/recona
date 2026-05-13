import { getSupabaseClient } from './supabase'
import type { ReconciliationResult, Discrepancy } from '@/types'

export interface RunSummary {
  id: string
  created_at: string
  charges_filename: string
  invoices_filename: string
  fee_schedule_filename: string | null
  has_fee_schedule: boolean
  discrepancy_count: number
  total_amount_at_risk: number
  total_overbilled: number
  total_underbilled: number
  total_charges_records: number
  total_invoices_records: number
  exact_matches: number
  fuzzy_matches: number
  ai_summary: string | null
}

export interface RunDetail extends RunSummary {
  merchant_summaries: unknown
  product_line_summaries: unknown
  discrepancies: DbDiscrepancy[]
}

export interface DbDiscrepancy {
  id: string
  run_id: string
  created_at: string
  type: string
  severity: string
  amount_at_risk: number
  direction: string
  merchant_id: string
  merchant_name: string
  product_line: string | null
  ai_reason: string | null
  root_cause: string | null
  confidence_score: number | null
  charges_record: unknown
  invoices_record: unknown
  fee_schedule_record: unknown
}

export interface SaveRunInput {
  result: ReconciliationResult
  chargesFilename: string
  invoicesFilename: string
  feeScheduleFilename?: string
  userId?: string
  orgId?: string
  ipAddress?: string
}

export interface AuditLogEntry {
  id: string
  created_at: string
  action: string
  run_id: string | null
  discrepancy_id: string | null
  user_id: string | null
  ip_address: string | null
  org_id: string | null
  metadata: Record<string, unknown> | null
}

export interface UsageSummary {
  runs: number
  rowsProcessed: number
  discrepanciesFound: number
  aiAssistedMatches: number
  totalAmountAtRisk: number
}

interface DataScope {
  userId?: string
  orgId?: string
}

const DISCREPANCY_INSERT_BATCH_SIZE = 500

function applyScope<T>(
  query: T,
  scope: DataScope = {}
): T {
  const scopedQuery = query as {
    eq: (column: string, value: string) => T
  }
  if (scope.orgId) return scopedQuery.eq('org_id', scope.orgId)
  if (scope.userId) return scopedQuery.eq('user_id', scope.userId)
  return query
}

async function withQueryTimeout<T>(promise: PromiseLike<T>, timeoutMs = 5000): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error('DB request timed out')), timeoutMs)
  })

  try {
    return (await Promise.race([promise as unknown as Promise<T>, timeout])) as T
  } finally {
    if (timer) clearTimeout(timer)
  }
}

export async function logAudit(input: {
  action: string
  runId?: string
  discrepancyId?: string
  userId?: string
  orgId?: string
  ipAddress?: string
  metadata?: Record<string, unknown>
}): Promise<void> {
  const db = getSupabaseClient()
  if (!db) return

  const { error } = await withQueryTimeout(
    db.from('audit_log').insert({
      action: input.action,
      run_id: input.runId ?? null,
      discrepancy_id: input.discrepancyId ?? null,
      user_id: input.userId ?? null,
      org_id: input.orgId ?? null,
      ip_address: input.ipAddress ?? null,
      metadata: input.metadata ?? null,
    })
  )

  if (error) console.error('[db] logAudit failed:', error)
}

export async function saveRun(input: SaveRunInput): Promise<string | null> {
  const db = getSupabaseClient()
  if (!db) return null

  const { result, chargesFilename, invoicesFilename, feeScheduleFilename, userId, orgId, ipAddress } = input

  const { data: run, error: runErr } = await withQueryTimeout(
    db
      .from('reconciliation_runs')
      .insert({
        charges_filename: chargesFilename,
        invoices_filename: invoicesFilename,
        fee_schedule_filename: feeScheduleFilename ?? null,
        has_fee_schedule: result.hasFeeSchedule,
        user_id: userId ?? null,
        org_id: orgId ?? null,
        total_charges_records: result.totalChargesRecords,
        total_invoices_records: result.totalInvoicesRecords,
        exact_matches: result.exactMatches,
        fuzzy_matches: result.fuzzyMatches,
        discrepancy_count: result.discrepancyCount,
        total_amount_at_risk: result.totalAmountAtRisk,
        total_overbilled: result.totalOverbilled,
        total_underbilled: result.totalUnderbilled,
        ai_summary: result.aiSummary,
        merchant_summaries: result.merchantSummaries,
        product_line_summaries: result.productLineSummaries,
      })
      .select('id')
      .single()
  )

  if (runErr || !run) {
    console.error('[db] saveRun failed:', runErr)
    return null
  }

  const runId = run.id as string

  if (result.discrepancies.length > 0) {
    const rows = result.discrepancies.map((d: Discrepancy) => ({
      run_id: runId,
      type: d.type,
      severity: d.severity,
      amount_at_risk: d.amountAtRisk,
      direction: d.direction,
      merchant_id: d.merchantId,
      merchant_name: d.merchantName,
      product_line: d.productLine ?? null,
      ai_reason: d.aiReason ?? null,
      root_cause: d.rootCause ?? null,
      confidence_score: d.confidenceScore ?? null,
      charges_record: d.chargesRecord ?? null,
      invoices_record: d.invoicesRecord ?? null,
      fee_schedule_record: d.feeScheduleRecord ?? null,
    }))

    for (let i = 0; i < rows.length; i += DISCREPANCY_INSERT_BATCH_SIZE) {
      const chunk = rows.slice(i, i + DISCREPANCY_INSERT_BATCH_SIZE)
      const { error: discErr } = await withQueryTimeout(db.from('discrepancies').insert(chunk), 10000)
      if (discErr) {
        console.error('[db] saveDiscrepancies failed:', discErr)
        break
      }
    }
  }

  await logAudit({
    action: 'reconciliation_run_created',
    runId,
    userId,
    orgId,
    ipAddress,
    metadata: {
      discrepancy_count: result.discrepancyCount,
      total_amount_at_risk: result.totalAmountAtRisk,
    },
  })

  return runId
}

export async function getAuditLog(opts: {
  limit?: number
  action?: string
  userId?: string
  startDate?: string
  endDate?: string
  orgId?: string
} = {}): Promise<AuditLogEntry[]> {
  const db = getSupabaseClient()
  if (!db) return []

  let query = applyScope(
    db
      .from('audit_log')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(opts.limit ?? 500),
    { userId: opts.userId, orgId: opts.orgId }
  )

  if (opts.action) query = query.eq('action', opts.action)
  if (opts.startDate) query = query.gte('created_at', opts.startDate)
  if (opts.endDate) query = query.lte('created_at', opts.endDate + 'T23:59:59Z')

  const { data, error } = await withQueryTimeout(query as unknown as PromiseLike<{ data: unknown; error: unknown }>)
  if (error) {
    console.error('[db] getAuditLog failed:', error)
    return []
  }
  return (data ?? []) as AuditLogEntry[]
}

export async function getRuns(limit = 50, scope: DataScope = {}): Promise<RunSummary[]> {
  const db = getSupabaseClient()
  if (!db) return []

  const { data, error } = await withQueryTimeout(
    applyScope(
      db
        .from('reconciliation_runs')
        .select(
          'id, created_at, charges_filename, invoices_filename, fee_schedule_filename, has_fee_schedule, discrepancy_count, total_amount_at_risk, total_overbilled, total_underbilled, total_charges_records, total_invoices_records, exact_matches, fuzzy_matches, ai_summary'
        )
        .order('created_at', { ascending: false })
        .limit(limit),
      scope
    )
  )

  if (error) {
    console.error('[db] getRuns failed:', error)
    return []
  }

  return (data ?? []) as RunSummary[]
}

export async function getUsageSummary(scope: DataScope = {}): Promise<UsageSummary> {
  const runs = await getRuns(500, scope)

  return runs.reduce<UsageSummary>(
    (summary, run) => ({
      runs: summary.runs + 1,
      rowsProcessed: summary.rowsProcessed + run.total_charges_records + run.total_invoices_records,
      discrepanciesFound: summary.discrepanciesFound + run.discrepancy_count,
      aiAssistedMatches: summary.aiAssistedMatches + run.fuzzy_matches,
      totalAmountAtRisk: summary.totalAmountAtRisk + Number(run.total_amount_at_risk),
    }),
    {
      runs: 0,
      rowsProcessed: 0,
      discrepanciesFound: 0,
      aiAssistedMatches: 0,
      totalAmountAtRisk: 0,
    }
  )
}

export async function getRunById(id: string, scope: DataScope = {}): Promise<RunDetail | null> {
  const db = getSupabaseClient()
  if (!db) return null

  const [runRes, discRes] = await Promise.all([
    withQueryTimeout(
      applyScope(
        db
          .from('reconciliation_runs')
          .select('*')
          .eq('id', id),
        scope
      ).single()
    ),
    withQueryTimeout(
      db
        .from('discrepancies')
        .select('*')
        .eq('run_id', id)
        .order('amount_at_risk', { ascending: false })
    ),
  ])

  if (runRes.error || !runRes.data) {
    console.error('[db] getRunById failed:', runRes.error)
    return null
  }

  return {
    ...(runRes.data as RunSummary),
    merchant_summaries: (runRes.data as Record<string, unknown>).merchant_summaries,
    product_line_summaries: (runRes.data as Record<string, unknown>).product_line_summaries,
    discrepancies: (discRes.data ?? []) as DbDiscrepancy[],
  }
}
