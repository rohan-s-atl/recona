import { createHash, createHmac, randomBytes } from 'crypto'
import { getSupabaseClient } from './supabase'
import type {
  ReconciliationResult,
  Discrepancy,
  DiscrepancyStatus,
  ReconciliationCadence,
  ResolutionType,
  ResolutionSuggestionType,
  RootCauseCategory,
} from '@/types'
import type { ParsedFile } from './fileParser'

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
  root_cause_category: RootCauseCategory | null
  status: DiscrepancyStatus | null
  assigned_to: string | null
  assigned_by: string | null
  assignment_note: string | null
  assigned_at: string | null
  due_at: string | null
  resolution_type: ResolutionType | null
  resolution_comment: string | null
  resolved_by: string | null
  resolved_at: string | null
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
  scheduleId?: string
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

export interface OrganizationSettings {
  scope_key: string
  org_id: string | null
  user_id: string | null
  alert_threshold_cents: number
  slack_webhook_url: string | null
  slack_channel: string | null
  weekly_digest_enabled: boolean
  email_alerts_enabled: boolean
  slack_alerts_enabled: boolean
}

export interface WorkflowAnalytics {
  open: number
  inReview: number
  resolved: number
  overdue: number
  resolutionRate: number
  totalAtRisk: number
  recovered: number
  rootCauseCounts: Record<string, number>
  monthTrend: { month: string; atRisk: number; issues: number; resolved: number }[]
  chronicMerchants: { merchantName: string; occurrences: number; atRisk: number }[]
  productTrend: { productLine: string; atRisk: number; issues: number }[]
}

export interface NotificationOutboxRow {
  id: string
  created_at: string
  sent_at: string | null
  next_attempt_at: string
  attempt_count: number
  channel: 'email' | 'slack'
  event_type: string
  recipient: string | null
  run_id: string | null
  discrepancy_id: string | null
  org_id: string | null
  user_id: string | null
  payload: Record<string, unknown>
  status: 'queued' | 'sent' | 'failed' | 'skipped'
  error: string | null
}

export interface ShareLink {
  id: string
  token: string
  urlPath: string
  expiresAt: string
}

export interface SourceSnapshot {
  id: string
  created_at: string
  org_id: string | null
  user_id: string | null
  role: 'charges' | 'invoices' | 'fee_schedule'
  name: string
  filename: string
  headers: string[]
  rows: Record<string, string>[]
  row_count: number
  mapping: Record<string, string | null> | null
  checksum: string | null
  expires_at: string | null
}

export interface ReconciliationSchedule {
  id: string
  created_at: string
  updated_at: string
  org_id: string | null
  user_id: string | null
  name: string
  cadence: ReconciliationCadence
  timezone: string
  run_at_local: string
  product_line: string | null
  catch_fast_enabled: boolean
  rolling_window_days: number
  charges_snapshot_id: string
  invoices_snapshot_id: string
  fee_schedule_snapshot_id: string | null
  charges_mapping: Record<string, string | null>
  invoices_mapping: Record<string, string | null>
  enabled: boolean
  last_run_at: string | null
  next_run_at: string
  last_run_id: string | null
  last_error: string | null
  locked_at: string | null
  locked_by: string | null
  run_count: number
  failure_count: number
}

export interface ResolutionSuggestion {
  id: string
  created_at: string
  run_id: string
  discrepancy_id: string
  org_id: string | null
  user_id: string | null
  suggestion_type: ResolutionSuggestionType
  confidence_score: number
  title: string
  proposed_action: string
  payload: Record<string, unknown>
  status: 'pending' | 'approved' | 'rejected' | 'applied'
  approved_by: string | null
  approved_at: string | null
}

export interface RecoveryScorecard {
  totalUnderbilledRecovered: number
  totalOverbillingReversed: number
  totalWaived: number
  totalEscalated: number
  byMonth: { month: string; recovered: number; reversed: number }[]
  byProductLine: { productLine: string; amount: number }[]
  byDiscrepancyType: { type: string; amount: number }[]
}

export interface ComplianceControls {
  scope_key: string
  org_id: string | null
  user_id: string | null
  retention_days: number
  auto_delete_enabled: boolean
  soc2_process_started_at: string | null
  evidence_collection_enabled: boolean
  data_processing_region: string
  updated_at: string
}

interface DataScope {
  userId?: string
  orgId?: string
}

const DISCREPANCY_INSERT_BATCH_SIZE = 500
const DEFAULT_ALERT_THRESHOLD_CENTS = 50000
const SHARE_LINK_TTL_DAYS = 14

function nextRunAt(cadence: ReconciliationCadence, from = new Date()): string {
  const next = new Date(from)
  if (cadence === 'daily') next.setDate(next.getDate() + 1)
  if (cadence === 'weekly') next.setDate(next.getDate() + 7)
  if (cadence === 'monthly') next.setMonth(next.getMonth() + 1)
  return next.toISOString()
}

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

function scopeKey(scope: DataScope = {}): string {
  if (scope.orgId) return `org:${scope.orgId}`
  if (scope.userId) return `user:${scope.userId}`
  return 'anonymous'
}

function classifyRootCause(discrepancy: Pick<Discrepancy, 'type' | 'rootCause' | 'aiReason'>): RootCauseCategory {
  const text = `${discrepancy.type} ${discrepancy.rootCause ?? ''} ${discrepancy.aiReason ?? ''}`.toLowerCase()
  if (discrepancy.type === 'duplicate_invoice' || text.includes('duplicate')) return 'duplicate_record'
  if (discrepancy.type === 'closed_account_billed' || text.includes('closed') || text.includes('deactivation')) {
    return 'account_lifecycle_failure'
  }
  if (discrepancy.type === 'proration_error' || text.includes('prorat')) return 'proration_logic_mismatch'
  if (discrepancy.type === 'rate_mismatch' || text.includes('rate')) return 'rate_table_error'
  if (discrepancy.type === 'plan_mismatch' || text.includes('upgrade') || text.includes('downgrade')) {
    return 'plan_sync_failure'
  }
  if (discrepancy.type === 'missing_contracted_fee' || text.includes('provision')) return 'provisioning_gap'
  if (text.includes('manual') || text.includes('waiver') || text.includes('override')) return 'manual_override_not_propagated'
  if (discrepancy.type === 'missing_from_billing' || discrepancy.type === 'missing_from_charges' || text.includes('sync')) {
    return 'data_sync_failure'
  }
  return 'unclassified'
}

function hashShareToken(token: string): string {
  const secret = process.env.SHARE_LINK_SECRET ?? process.env.INTERNAL_WORKER_SECRET ?? 'dev-share-link-secret'
  return createHmac('sha256', secret).update(token).digest('hex')
}

function hashText(value: string): string {
  return createHash('sha256').update(value).digest('hex')
}

export async function logAiAudit(input: {
  event: string
  model?: string
  runId?: string | null
  discrepancyId?: string | null
  userId?: string | null
  orgId?: string | null
  prompt?: string
  inputSummary?: Record<string, unknown>
  outputSummary?: Record<string, unknown>
  confidenceScore?: number | null
  latencyMs?: number
  status?: 'ok' | 'failed' | 'skipped'
}): Promise<void> {
  const db = getSupabaseClient()
  if (!db) return
  const { error } = await withQueryTimeout(
    db.from('ai_audit_log').insert({
      event: input.event,
      model: input.model ?? null,
      run_id: input.runId ?? null,
      discrepancy_id: input.discrepancyId ?? null,
      user_id: input.userId ?? null,
      org_id: input.orgId ?? null,
      prompt_hash: input.prompt ? hashText(input.prompt) : null,
      input_summary: input.inputSummary ?? {},
      output_summary: input.outputSummary ?? {},
      confidence_score: input.confidenceScore ?? null,
      latency_ms: input.latencyMs ?? null,
      status: input.status ?? 'ok',
    })
  )
  if (error) console.error('[db] logAiAudit failed:', error)
}

async function enqueueNotification(input: {
  channel: 'email' | 'slack'
  eventType: string
  recipient?: string | null
  runId?: string | null
  discrepancyId?: string | null
  orgId?: string
  userId?: string
  payload?: Record<string, unknown>
}): Promise<void> {
  const db = getSupabaseClient()
  if (!db) return

  const { error } = await withQueryTimeout(
    db.from('notification_outbox').insert({
      channel: input.channel,
      event_type: input.eventType,
      recipient: input.recipient ?? null,
      run_id: input.runId ?? null,
      discrepancy_id: input.discrepancyId ?? null,
      org_id: input.orgId ?? null,
      user_id: input.userId ?? null,
      payload: input.payload ?? {},
      status: 'queued',
      next_attempt_at: new Date().toISOString(),
      attempt_count: 0,
    })
  )
  if (error) console.error('[db] enqueueNotification failed:', error)
}

export async function getQueuedNotifications(limit = 25): Promise<NotificationOutboxRow[]> {
  const db = getSupabaseClient()
  if (!db) return []
  const { data, error } = await withQueryTimeout(
    db
      .from('notification_outbox')
      .select('*')
      .eq('status', 'queued')
      .lte('next_attempt_at', new Date().toISOString())
      .order('created_at', { ascending: true })
      .limit(limit)
  )
  if (error) {
    console.error('[db] getQueuedNotifications failed:', error)
    return []
  }
  return (data ?? []) as NotificationOutboxRow[]
}

export async function markNotificationDelivered(id: string): Promise<void> {
  const db = getSupabaseClient()
  if (!db) return
  const { error } = await withQueryTimeout(
    db.from('notification_outbox').update({ status: 'sent', sent_at: new Date().toISOString(), error: null }).eq('id', id)
  )
  if (error) console.error('[db] markNotificationDelivered failed:', error)
}

export async function markNotificationSkipped(id: string, reason: string): Promise<void> {
  const db = getSupabaseClient()
  if (!db) return
  const { error } = await withQueryTimeout(
    db.from('notification_outbox').update({ status: 'skipped', error: reason }).eq('id', id)
  )
  if (error) console.error('[db] markNotificationSkipped failed:', error)
}

export async function markNotificationFailed(row: NotificationOutboxRow, errorMessage: string): Promise<void> {
  const db = getSupabaseClient()
  if (!db) return
  const nextAttemptCount = row.attempt_count + 1
  const permanentlyFailed = nextAttemptCount >= 5
  const retryDelayMinutes = Math.min(60, 2 ** nextAttemptCount)
  const { error } = await withQueryTimeout(
    db
      .from('notification_outbox')
      .update({
        status: permanentlyFailed ? 'failed' : 'queued',
        attempt_count: nextAttemptCount,
        next_attempt_at: new Date(Date.now() + retryDelayMinutes * 60_000).toISOString(),
        error: errorMessage,
      })
      .eq('id', row.id)
  )
  if (error) console.error('[db] markNotificationFailed failed:', error)
}

export async function enqueueOverdueNotifications(limit = 100): Promise<number> {
  const db = getSupabaseClient()
  if (!db) return 0
  const { data: overdueRows, error: overdueError } = await withQueryTimeout(
    db
      .from('discrepancies')
      .select('id, run_id, assigned_to, due_at, merchant_name, amount_at_risk')
      .neq('status', 'resolved')
      .not('assigned_to', 'is', null)
      .lt('due_at', new Date().toISOString())
      .limit(limit)
  )
  if (overdueError) {
    console.error('[db] enqueueOverdueNotifications failed:', overdueError)
    return 0
  }

  const rows = (overdueRows ?? []) as {
    id: string
    run_id: string
    assigned_to: string | null
    due_at: string | null
    merchant_name: string
    amount_at_risk: number
  }[]
  if (rows.length === 0) return 0

  const { data: existing } = await withQueryTimeout(
    db
      .from('notification_outbox')
      .select('discrepancy_id')
      .eq('event_type', 'discrepancy_overdue')
      .in('discrepancy_id', rows.map((row) => row.id))
  )
  const alreadyQueued = new Set(((existing ?? []) as { discrepancy_id: string | null }[]).map((row) => row.discrepancy_id))

  let queued = 0
  for (const row of rows) {
    if (!row.assigned_to || alreadyQueued.has(row.id)) continue
    await enqueueNotification({
      channel: 'email',
      eventType: 'discrepancy_overdue',
      recipient: row.assigned_to,
      runId: row.run_id,
      discrepancyId: row.id,
      payload: {
        merchant: row.merchant_name,
        amount_at_risk: row.amount_at_risk,
        due_at: row.due_at,
      },
    })
    queued += 1
  }
  return queued
}

export async function saveRun(input: SaveRunInput): Promise<string | null> {
  const db = getSupabaseClient()
  if (!db) return null

  const { result, chargesFilename, invoicesFilename, feeScheduleFilename, scheduleId, userId, orgId, ipAddress } = input

  const { data: run, error: runErr } = await withQueryTimeout(
    db
      .from('reconciliation_runs')
      .insert({
        charges_filename: chargesFilename,
        invoices_filename: invoicesFilename,
        fee_schedule_filename: feeScheduleFilename ?? null,
        has_fee_schedule: result.hasFeeSchedule,
        schedule_id: scheduleId ?? null,
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
        root_cause_category: classifyRootCause(d),
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

    const rootCauseCounts = rows.reduce<Record<string, number>>((counts, row) => {
      const key = row.root_cause_category
      counts[key] = (counts[key] ?? 0) + 1
      return counts
    }, {})
    await logAiAudit({
      event: 'root_cause_classification',
      runId,
      userId,
      orgId,
      inputSummary: { discrepancy_count: result.discrepancies.length },
      outputSummary: { root_cause_counts: rootCauseCounts },
      status: 'ok',
    })
    await createResolutionSuggestionsForRun(runId, { userId, orgId })
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

  const settings = await getOrganizationSettings({ userId, orgId })
  const threshold = settings.alert_threshold_cents / 100
  await enqueueNotification({
    channel: 'email',
    eventType: 'run_complete',
    recipient: userId,
    runId,
    orgId,
    userId,
    payload: {
      discrepancy_count: result.discrepancyCount,
      total_amount_at_risk: result.totalAmountAtRisk,
    },
  })
  if (settings.slack_alerts_enabled) {
    await enqueueNotification({
      channel: 'slack',
      eventType: 'run_complete',
      runId,
      orgId,
      userId,
      payload: {
        channel: settings.slack_channel,
        discrepancy_count: result.discrepancyCount,
        total_amount_at_risk: result.totalAmountAtRisk,
      },
    })
  }
  for (const discrepancy of result.discrepancies.filter((d) => d.amountAtRisk >= threshold)) {
    await enqueueNotification({
      channel: 'email',
      eventType: 'threshold_exceeded',
      recipient: userId,
      runId,
      orgId,
      userId,
      payload: {
        merchant: discrepancy.merchantName,
        amount_at_risk: discrepancy.amountAtRisk,
        threshold,
      },
    })
  }

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

export async function getOrganizationSettings(scope: DataScope = {}): Promise<OrganizationSettings> {
  const db = getSupabaseClient()
  const key = scopeKey(scope)
  const fallback: OrganizationSettings = {
    scope_key: key,
    org_id: scope.orgId ?? null,
    user_id: scope.userId ?? null,
    alert_threshold_cents: DEFAULT_ALERT_THRESHOLD_CENTS,
    slack_webhook_url: null,
    slack_channel: null,
    weekly_digest_enabled: true,
    email_alerts_enabled: true,
    slack_alerts_enabled: false,
  }
  if (!db) return fallback

  const { data, error } = await withQueryTimeout(
    db.from('organization_settings').select('*').eq('scope_key', key).maybeSingle()
  )
  if (error) {
    console.error('[db] getOrganizationSettings failed:', error)
    return fallback
  }
  return data ? (data as OrganizationSettings) : fallback
}

export async function createSourceSnapshot(input: {
  scope?: DataScope
  role: SourceSnapshot['role']
  name: string
  filename: string
  parsed: ParsedFile
  mapping?: Record<string, string | null> | null
  retentionDays?: number
}): Promise<SourceSnapshot | null> {
  const db = getSupabaseClient()
  if (!db) return null
  const serialized = JSON.stringify(input.parsed.rows)
  const expiresAt = input.retentionDays
    ? new Date(Date.now() + input.retentionDays * 24 * 60 * 60 * 1000).toISOString()
    : null
  const { data, error } = await withQueryTimeout(
    db
      .from('source_snapshots')
      .insert({
        org_id: input.scope?.orgId ?? null,
        user_id: input.scope?.userId ?? null,
        role: input.role,
        name: input.name,
        filename: input.filename,
        headers: input.parsed.headers,
        rows: input.parsed.rows,
        row_count: input.parsed.rows.length,
        mapping: input.mapping ?? null,
        checksum: hashText(serialized),
        expires_at: expiresAt,
      })
      .select('*')
      .single()
  )
  if (error) {
    console.error('[db] createSourceSnapshot failed:', error)
    return null
  }
  return data as SourceSnapshot
}

export async function getSourceSnapshots(scope: DataScope = {}): Promise<SourceSnapshot[]> {
  const db = getSupabaseClient()
  if (!db) return []
  const { data, error } = await withQueryTimeout(
    applyScope(db.from('source_snapshots').select('*').order('created_at', { ascending: false }).limit(100), scope)
  )
  if (error) {
    console.error('[db] getSourceSnapshots failed:', error)
    return []
  }
  return (data ?? []) as SourceSnapshot[]
}

export async function getSourceSnapshotById(id: string): Promise<SourceSnapshot | null> {
  const db = getSupabaseClient()
  if (!db) return null
  const { data, error } = await withQueryTimeout(db.from('source_snapshots').select('*').eq('id', id).maybeSingle())
  if (error) {
    console.error('[db] getSourceSnapshotById failed:', error)
    return null
  }
  return data ? (data as SourceSnapshot) : null
}

export async function createReconciliationSchedule(input: {
  scope?: DataScope
  name: string
  cadence: ReconciliationCadence
  timezone?: string
  runAtLocal?: string
  productLine?: string | null
  catchFastEnabled?: boolean
  rollingWindowDays?: number
  chargesSnapshotId: string
  invoicesSnapshotId: string
  feeScheduleSnapshotId?: string | null
  chargesMapping: Record<string, string | null>
  invoicesMapping: Record<string, string | null>
}): Promise<ReconciliationSchedule | null> {
  const db = getSupabaseClient()
  if (!db) return null
  const [chargesSnapshot, invoicesSnapshot, feeSnapshot] = await Promise.all([
    getSourceSnapshotById(input.chargesSnapshotId),
    getSourceSnapshotById(input.invoicesSnapshotId),
    input.feeScheduleSnapshotId ? getSourceSnapshotById(input.feeScheduleSnapshotId) : Promise.resolve(null),
  ])
  if (!chargesSnapshot || chargesSnapshot.role !== 'charges') return null
  if (!invoicesSnapshot || invoicesSnapshot.role !== 'invoices') return null
  if (feeSnapshot && feeSnapshot.role !== 'fee_schedule') return null
  const sameScope = (snapshot: SourceSnapshot) =>
    (input.scope?.orgId ? snapshot.org_id === input.scope.orgId : true) &&
    (!input.scope?.orgId && input.scope?.userId ? snapshot.user_id === input.scope.userId : true)
  if (!sameScope(chargesSnapshot) || !sameScope(invoicesSnapshot) || (feeSnapshot && !sameScope(feeSnapshot))) return null

  const { data, error } = await withQueryTimeout(
    db
      .from('reconciliation_schedules')
      .insert({
        org_id: input.scope?.orgId ?? null,
        user_id: input.scope?.userId ?? null,
        name: input.name,
        cadence: input.cadence,
        timezone: input.timezone ?? 'America/New_York',
        run_at_local: input.runAtLocal ?? '09:00',
        product_line: input.productLine ?? null,
        catch_fast_enabled: input.catchFastEnabled ?? false,
        rolling_window_days: input.rollingWindowDays ?? 3,
        charges_snapshot_id: input.chargesSnapshotId,
        invoices_snapshot_id: input.invoicesSnapshotId,
        fee_schedule_snapshot_id: input.feeScheduleSnapshotId ?? null,
        charges_mapping: input.chargesMapping,
        invoices_mapping: input.invoicesMapping,
        next_run_at: nextRunAt(input.cadence, new Date(Date.now() - 24 * 60 * 60 * 1000)),
      })
      .select('*')
      .single()
  )
  if (error) {
    console.error('[db] createReconciliationSchedule failed:', error)
    return null
  }
  return data as ReconciliationSchedule
}

export async function getReconciliationSchedules(scope: DataScope = {}): Promise<ReconciliationSchedule[]> {
  const db = getSupabaseClient()
  if (!db) return []
  const { data, error } = await withQueryTimeout(
    applyScope(db.from('reconciliation_schedules').select('*').order('created_at', { ascending: false }), scope)
  )
  if (error) {
    console.error('[db] getReconciliationSchedules failed:', error)
    return []
  }
  return (data ?? []) as ReconciliationSchedule[]
}

export async function getDueReconciliationSchedules(limit = 25): Promise<ReconciliationSchedule[]> {
  const db = getSupabaseClient()
  if (!db) return []
  const lockExpiredAt = new Date(Date.now() - 30 * 60 * 1000).toISOString()
  const { data, error } = await withQueryTimeout(
    db
      .from('reconciliation_schedules')
      .select('*')
      .eq('enabled', true)
      .lte('next_run_at', new Date().toISOString())
      .or(`locked_at.is.null,locked_at.lt.${lockExpiredAt}`)
      .order('next_run_at', { ascending: true })
      .limit(limit)
  )
  if (error) {
    console.error('[db] getDueReconciliationSchedules failed:', error)
    return []
  }
  return (data ?? []) as ReconciliationSchedule[]
}

export async function claimReconciliationSchedule(
  scheduleId: string,
  workerId: string
): Promise<ReconciliationSchedule | null> {
  const db = getSupabaseClient()
  if (!db) return null
  const lockExpiredAt = new Date(Date.now() - 30 * 60 * 1000).toISOString()
  const { data, error } = await withQueryTimeout(
    db
      .from('reconciliation_schedules')
      .update({ locked_at: new Date().toISOString(), locked_by: workerId, last_error: null })
      .eq('id', scheduleId)
      .eq('enabled', true)
      .lte('next_run_at', new Date().toISOString())
      .or(`locked_at.is.null,locked_at.lt.${lockExpiredAt}`)
      .select('*')
      .maybeSingle()
  )
  if (error) {
    console.error('[db] claimReconciliationSchedule failed:', error)
    return null
  }
  return data ? (data as ReconciliationSchedule) : null
}

export async function markScheduleRun(
  schedule: ReconciliationSchedule,
  input: { runId?: string | null; error?: string | null }
): Promise<void> {
  const db = getSupabaseClient()
  if (!db) return
  const patch = input.error
    ? {
        last_error: input.error,
        next_run_at: nextRunAt(schedule.cadence),
        locked_at: null,
        locked_by: null,
        failure_count: (schedule.failure_count ?? 0) + 1,
      }
    : {
        last_error: null,
        last_run_at: new Date().toISOString(),
        last_run_id: input.runId ?? null,
        next_run_at: nextRunAt(schedule.cadence),
        locked_at: null,
        locked_by: null,
        run_count: (schedule.run_count ?? 0) + 1,
      }
  const { error } = await withQueryTimeout(db.from('reconciliation_schedules').update(patch).eq('id', schedule.id))
  if (error) console.error('[db] markScheduleRun failed:', error)
}

export async function updateOrganizationSettings(
  scope: DataScope,
  input: Partial<Pick<
    OrganizationSettings,
    | 'alert_threshold_cents'
    | 'slack_webhook_url'
    | 'slack_channel'
    | 'weekly_digest_enabled'
    | 'email_alerts_enabled'
    | 'slack_alerts_enabled'
  >>
): Promise<OrganizationSettings | null> {
  const db = getSupabaseClient()
  if (!db) return null
  const key = scopeKey(scope)
  const row = {
    scope_key: key,
    org_id: scope.orgId ?? null,
    user_id: scope.userId ?? null,
    ...input,
    updated_at: new Date().toISOString(),
  }
  const { data, error } = await withQueryTimeout(
    db.from('organization_settings').upsert(row, { onConflict: 'scope_key' }).select('*').single()
  )
  if (error) {
    console.error('[db] updateOrganizationSettings failed:', error)
    return null
  }
  return data as OrganizationSettings
}

export async function updateDiscrepancyWorkflow(input: {
  ids: string[]
  scope?: DataScope
  actorId?: string | null
  assignedTo?: string | null
  assignmentNote?: string | null
  dueAt?: string | null
  status?: DiscrepancyStatus
  resolutionType?: ResolutionType | null
  resolutionComment?: string | null
}): Promise<DbDiscrepancy[]> {
  const db = getSupabaseClient()
  if (!db || input.ids.length === 0) return []

  const patch: Record<string, unknown> = {}
  const now = new Date().toISOString()
  if (input.assignedTo !== undefined) {
    patch.assigned_to = input.assignedTo || null
    patch.assigned_by = input.actorId ?? null
    patch.assignment_note = input.assignmentNote ?? null
    patch.assigned_at = input.assignedTo ? now : null
    patch.status = input.status ?? (input.assignedTo ? 'in_review' : 'open')
    patch.due_at = input.dueAt ?? null
  }
  if (input.status) patch.status = input.status
  if (input.status === 'resolved') {
    if (!input.resolutionComment?.trim()) throw new Error('Resolution comment is required')
    patch.resolution_type = input.resolutionType ?? 'corrected'
    patch.resolution_comment = input.resolutionComment.trim()
    patch.resolved_by = input.actorId ?? null
    patch.resolved_at = now
  } else if (input.status) {
    patch.resolution_type = null
    patch.resolution_comment = null
    patch.resolved_by = null
    patch.resolved_at = null
  }

  let query = db.from('discrepancies').update(patch).in('id', input.ids).select('*')
  if (input.scope?.orgId || input.scope?.userId) {
    const runs = await getRuns(500, input.scope)
    query = query.in('run_id', runs.map((run) => run.id))
  }
  const { data, error } = await withQueryTimeout(query)
  if (error) throw new Error(error.message)

  for (const id of input.ids) {
    await logAudit({
      action: input.status === 'resolved' ? 'discrepancy_resolved' : 'discrepancy_workflow_updated',
      discrepancyId: id,
      userId: input.actorId ?? undefined,
      orgId: input.scope?.orgId,
      metadata: patch,
    })
    if (input.assignedTo) {
      await enqueueNotification({
        channel: 'email',
        eventType: 'discrepancy_assigned',
        recipient: input.assignedTo,
        discrepancyId: id,
        orgId: input.scope?.orgId,
        userId: input.actorId ?? undefined,
        payload: { note: input.assignmentNote ?? null, due_at: input.dueAt ?? null },
      })
    }
  }

  return (data ?? []) as DbDiscrepancy[]
}

function suggestionForDiscrepancy(d: DbDiscrepancy): {
  suggestion_type: ResolutionSuggestionType
  confidence_score: number
  title: string
  proposed_action: string
  payload: Record<string, unknown>
} {
  const amount = Number(d.amount_at_risk)
  if (d.type === 'missing_from_billing') {
    return {
      suggestion_type: 'draft_invoice',
      confidence_score: 0.86,
      title: `Draft invoice for ${d.merchant_name}`,
      proposed_action: `Draft invoice for ${d.merchant_name} for ${amount.toLocaleString('en-US', { style: 'currency', currency: 'USD' })}.`,
      payload: { merchant_id: d.merchant_id, amount, product_line: d.product_line },
    }
  }
  if (d.type === 'missing_from_charges') {
    return {
      suggestion_type: 'issue_credit',
      confidence_score: 0.84,
      title: `Issue credit to ${d.merchant_name}`,
      proposed_action: `Issue customer credit for ${amount.toLocaleString('en-US', { style: 'currency', currency: 'USD' })} and investigate phantom billing.`,
      payload: { merchant_id: d.merchant_id, amount, product_line: d.product_line },
    }
  }
  if (d.type === 'rate_mismatch') {
    return {
      suggestion_type: 'correct_rate',
      confidence_score: 0.82,
      title: `Correct rate table for ${d.merchant_name}`,
      proposed_action: `Update billing rate table for ${d.merchant_name} and true up ${amount.toLocaleString('en-US', { style: 'currency', currency: 'USD' })}.`,
      payload: { merchant_id: d.merchant_id, amount, product_line: d.product_line },
    }
  }
  if (d.type === 'missing_contracted_fee' || d.type === 'plan_mismatch') {
    return {
      suggestion_type: 'provision_product',
      confidence_score: 0.8,
      title: `Provision product for ${d.merchant_name}`,
      proposed_action: `Provision or correct ${d.product_line ?? 'the product'} in billing, then recover ${amount.toLocaleString('en-US', { style: 'currency', currency: 'USD' })}.`,
      payload: { merchant_id: d.merchant_id, amount, product_line: d.product_line },
    }
  }
  if (d.type === 'closed_account_billed') {
    return {
      suggestion_type: 'deactivate_account',
      confidence_score: 0.88,
      title: `Deactivate billing for ${d.merchant_name}`,
      proposed_action: `Deactivate billing for the closed account and issue any required customer adjustment.`,
      payload: { merchant_id: d.merchant_id, amount, product_line: d.product_line },
    }
  }
  return {
    suggestion_type: 'review_manually',
    confidence_score: 0.62,
    title: `Review ${d.merchant_name}`,
    proposed_action: `Review supporting records for ${d.merchant_name} before applying a financial action.`,
    payload: { merchant_id: d.merchant_id, amount, product_line: d.product_line },
  }
}

export async function createResolutionSuggestionsForRun(runId: string, scope: DataScope = {}): Promise<number> {
  const db = getSupabaseClient()
  if (!db) return 0
  const { data: discrepancies, error } = await withQueryTimeout(
    db.from('discrepancies').select('*').eq('run_id', runId).order('amount_at_risk', { ascending: false })
  )
  if (error) {
    console.error('[db] createResolutionSuggestionsForRun failed:', error)
    return 0
  }
  const rows = ((discrepancies ?? []) as DbDiscrepancy[])
    .filter((d) => Number(d.amount_at_risk) > 0)
    .map((d) => ({
      run_id: runId,
      discrepancy_id: d.id,
      org_id: scope.orgId ?? null,
      user_id: scope.userId ?? null,
      ...suggestionForDiscrepancy(d),
    }))
  if (rows.length === 0) return 0
  const { error: insertError } = await withQueryTimeout(
    db.from('resolution_suggestions').upsert(rows, { onConflict: 'discrepancy_id', ignoreDuplicates: true })
  )
  if (insertError) {
    console.error('[db] insertResolutionSuggestions failed:', insertError)
    return 0
  }
  await logAiAudit({
    event: 'resolution_suggestions',
    runId,
    userId: scope.userId,
    orgId: scope.orgId,
    inputSummary: { discrepancy_count: rows.length },
    outputSummary: { suggestion_count: rows.length, generator: 'deterministic_resolution_v1' },
  })
  return rows.length
}

export async function getResolutionSuggestions(scope: DataScope = {}, limit = 200): Promise<ResolutionSuggestion[]> {
  const db = getSupabaseClient()
  if (!db) return []
  const { data, error } = await withQueryTimeout(
    applyScope(
      db.from('resolution_suggestions').select('*').order('created_at', { ascending: false }).limit(limit),
      scope
    )
  )
  if (error) {
    console.error('[db] getResolutionSuggestions failed:', error)
    return []
  }
  return (data ?? []) as ResolutionSuggestion[]
}

export async function createMissingResolutionSuggestions(scope: DataScope = {}): Promise<number> {
  const runs = await getRuns(500, scope)
  let created = 0
  for (const run of runs) {
    if (run.discrepancy_count === 0) continue
    created += await createResolutionSuggestionsForRun(run.id, scope)
  }
  return created
}

export async function getWorkflowNavCounts(input: {
  scope?: DataScope
  assignedTo?: string | null
} = {}): Promise<{ queue: number; pendingResolutions: number }> {
  const db = getSupabaseClient()
  if (!db) return { queue: 0, pendingResolutions: 0 }

  const assignedQuery = input.assignedTo
    ? withQueryTimeout(
        applyScope(
          db
            .from('discrepancies')
            .select('id', { count: 'exact', head: true })
            .eq('assigned_to', input.assignedTo)
            .neq('status', 'resolved'),
          input.scope ?? {}
        )
      )
    : Promise.resolve({ count: 0, error: null })
  const suggestionsQuery = withQueryTimeout(
    applyScope(
      db
        .from('resolution_suggestions')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'pending'),
      input.scope ?? {}
    )
  )
  const [assigned, suggestions] = await Promise.all([assignedQuery, suggestionsQuery])
  if (assigned.error || suggestions.error) {
    console.error('[db] getWorkflowNavCounts failed:', assigned.error ?? suggestions.error)
  }
  return {
    queue: assigned.count ?? 0,
    pendingResolutions: suggestions.count ?? 0,
  }
}

export async function approveResolutionSuggestions(input: {
  ids: string[]
  actorId?: string | null
  scope?: DataScope
}): Promise<number> {
  const db = getSupabaseClient()
  if (!db || input.ids.length === 0) return 0
  const { data: suggestions, error } = await withQueryTimeout(
    applyScope(
      db.from('resolution_suggestions').select('*, discrepancies(*)').in('id', input.ids).eq('status', 'pending'),
      input.scope ?? {}
    )
  )
  if (error) throw new Error(error.message)

  const now = new Date().toISOString()
  let approved = 0
  for (const suggestion of (suggestions ?? []) as (ResolutionSuggestion & { discrepancies: DbDiscrepancy })[]) {
    const d = suggestion.discrepancies
    const recoveryType =
      suggestion.suggestion_type === 'issue_credit'
        ? 'overbilling_reversed'
        : suggestion.suggestion_type === 'review_manually'
          ? 'escalated'
          : 'underbilled_recovered'
    const { data: updatedSuggestion, error: updateError } = await withQueryTimeout(
      db
        .from('resolution_suggestions')
        .update({ status: 'approved', approved_by: input.actorId ?? null, approved_at: now })
        .eq('id', suggestion.id)
        .eq('status', 'pending')
        .select('id')
        .maybeSingle()
    )
    if (updateError || !updatedSuggestion) continue
    const { error: ledgerError } = await withQueryTimeout(
      db.from('recovery_ledger').upsert({
        run_id: suggestion.run_id,
        discrepancy_id: suggestion.discrepancy_id,
        suggestion_id: suggestion.id,
        org_id: input.scope?.orgId ?? suggestion.org_id,
        user_id: input.scope?.userId ?? suggestion.user_id,
        approved_by: input.actorId ?? null,
        recovery_type: recoveryType,
        product_line: d.product_line,
        discrepancy_type: d.type,
        amount: Number(d.amount_at_risk),
        note: suggestion.proposed_action,
      }, { onConflict: 'suggestion_id', ignoreDuplicates: true })
    )
    if (ledgerError) throw new Error(ledgerError.message)
    await updateDiscrepancyWorkflow({
      ids: [suggestion.discrepancy_id],
      scope: input.scope,
      actorId: input.actorId,
      status: 'resolved',
      resolutionType: recoveryType === 'escalated' ? 'escalated' : 'corrected',
      resolutionComment: `Approved suggested action: ${suggestion.proposed_action}`,
    })
    approved += 1
  }
  return approved
}

export async function getAssignedDiscrepancies(assignedTo: string, scope: DataScope = {}): Promise<DbDiscrepancy[]> {
  const db = getSupabaseClient()
  if (!db) return []
  const runs = await getRuns(500, scope)
  if (runs.length === 0) return []
  const { data, error } = await withQueryTimeout(
    db
      .from('discrepancies')
      .select('*')
      .eq('assigned_to', assignedTo)
      .neq('status', 'resolved')
      .in('run_id', runs.map((run) => run.id))
      .order('due_at', { ascending: true, nullsFirst: false })
      .order('amount_at_risk', { ascending: false })
  )
  if (error) {
    console.error('[db] getAssignedDiscrepancies failed:', error)
    return []
  }
  return (data ?? []) as DbDiscrepancy[]
}

export async function getDiscrepanciesForScope(scope: DataScope = {}, limit = 1000): Promise<DbDiscrepancy[]> {
  const db = getSupabaseClient()
  if (!db) return []
  const runs = await getRuns(500, scope)
  if (runs.length === 0) return []
  const { data, error } = await withQueryTimeout(
    db
      .from('discrepancies')
      .select('*')
      .in('run_id', runs.map((run) => run.id))
      .order('amount_at_risk', { ascending: false })
      .limit(limit)
  )
  if (error) {
    console.error('[db] getDiscrepanciesForScope failed:', error)
    return []
  }
  return (data ?? []) as DbDiscrepancy[]
}

export async function getWorkflowAnalytics(scope: DataScope = {}): Promise<WorkflowAnalytics> {
  const db = getSupabaseClient()
  const empty: WorkflowAnalytics = {
    open: 0,
    inReview: 0,
    resolved: 0,
    overdue: 0,
    resolutionRate: 0,
    totalAtRisk: 0,
    recovered: 0,
    rootCauseCounts: {},
    monthTrend: [],
    chronicMerchants: [],
    productTrend: [],
  }
  if (!db) return empty
  const runs = await getRuns(500, scope)
  if (runs.length === 0) return empty
  const { data, error } = await withQueryTimeout(
    db
      .from('discrepancies')
      .select('*, reconciliation_runs(created_at)')
      .in('run_id', runs.map((run) => run.id))
  )
  if (error) {
    console.error('[db] getWorkflowAnalytics failed:', error)
    return empty
  }

  const rows = (data ?? []) as (DbDiscrepancy & { reconciliation_runs?: { created_at?: string } })[]
  const now = Date.now()
  const monthMap = new Map<string, { month: string; atRisk: number; issues: number; resolved: number }>()
  const merchantMap = new Map<string, { merchantName: string; occurrences: number; atRisk: number }>()
  const productMap = new Map<string, { productLine: string; atRisk: number; issues: number }>()

  for (const row of rows) {
    const status = row.status ?? 'open'
    if (status === 'open') empty.open += 1
    if (status === 'in_review') empty.inReview += 1
    if (status === 'resolved') empty.resolved += 1
    if (row.due_at && status !== 'resolved' && new Date(row.due_at).getTime() < now) empty.overdue += 1
    const amount = Number(row.amount_at_risk)
    empty.totalAtRisk += amount
    if (status === 'resolved' && row.resolution_type === 'corrected') empty.recovered += amount
    const cause = row.root_cause_category ?? 'unclassified'
    empty.rootCauseCounts[cause] = (empty.rootCauseCounts[cause] ?? 0) + 1

    const runDate = row.reconciliation_runs?.created_at ?? row.created_at
    const month = new Date(runDate).toISOString().slice(0, 7)
    const monthly = monthMap.get(month) ?? { month, atRisk: 0, issues: 0, resolved: 0 }
    monthly.atRisk += amount
    monthly.issues += 1
    if (status === 'resolved') monthly.resolved += 1
    monthMap.set(month, monthly)

    const merchant = merchantMap.get(row.merchant_id) ?? { merchantName: row.merchant_name, occurrences: 0, atRisk: 0 }
    merchant.occurrences += 1
    merchant.atRisk += amount
    merchantMap.set(row.merchant_id, merchant)

    const productLine = row.product_line ?? 'Unknown'
    const product = productMap.get(productLine) ?? { productLine, atRisk: 0, issues: 0 }
    product.atRisk += amount
    product.issues += 1
    productMap.set(productLine, product)
  }

  const total = rows.length
  empty.resolutionRate = total > 0 ? Math.round((empty.resolved / total) * 100) : 0
  empty.monthTrend = [...monthMap.values()].sort((a, b) => a.month.localeCompare(b.month))
  empty.chronicMerchants = [...merchantMap.values()]
    .filter((merchant) => merchant.occurrences > 1)
    .sort((a, b) => b.occurrences - a.occurrences || b.atRisk - a.atRisk)
    .slice(0, 10)
  empty.productTrend = [...productMap.values()].sort((a, b) => b.atRisk - a.atRisk).slice(0, 10)
  return empty
}

export async function getRecoveryScorecard(scope: DataScope = {}): Promise<RecoveryScorecard> {
  const db = getSupabaseClient()
  const scorecard: RecoveryScorecard = {
    totalUnderbilledRecovered: 0,
    totalOverbillingReversed: 0,
    totalWaived: 0,
    totalEscalated: 0,
    byMonth: [],
    byProductLine: [],
    byDiscrepancyType: [],
  }
  if (!db) return scorecard
  const { data, error } = await withQueryTimeout(
    applyScope(db.from('recovery_ledger').select('*').order('created_at', { ascending: true }), scope)
  )
  if (error) {
    console.error('[db] getRecoveryScorecard failed:', error)
    return scorecard
  }
  const monthMap = new Map<string, { month: string; recovered: number; reversed: number }>()
  const productMap = new Map<string, { productLine: string; amount: number }>()
  const typeMap = new Map<string, { type: string; amount: number }>()
  for (const row of (data ?? []) as {
    created_at: string
    recovery_type: string
    amount: number
    product_line: string | null
    discrepancy_type: string | null
  }[]) {
    const amount = Number(row.amount)
    if (row.recovery_type === 'underbilled_recovered') scorecard.totalUnderbilledRecovered += amount
    if (row.recovery_type === 'overbilling_reversed') scorecard.totalOverbillingReversed += amount
    if (row.recovery_type === 'waived') scorecard.totalWaived += amount
    if (row.recovery_type === 'escalated') scorecard.totalEscalated += amount
    const month = new Date(row.created_at).toISOString().slice(0, 7)
    const monthly = monthMap.get(month) ?? { month, recovered: 0, reversed: 0 }
    if (row.recovery_type === 'underbilled_recovered') monthly.recovered += amount
    if (row.recovery_type === 'overbilling_reversed') monthly.reversed += amount
    monthMap.set(month, monthly)
    const productLine = row.product_line ?? 'Unknown'
    const product = productMap.get(productLine) ?? { productLine, amount: 0 }
    product.amount += amount
    productMap.set(productLine, product)
    const type = row.discrepancy_type ?? 'unknown'
    const typeRow = typeMap.get(type) ?? { type, amount: 0 }
    typeRow.amount += amount
    typeMap.set(type, typeRow)
  }
  scorecard.byMonth = [...monthMap.values()]
  scorecard.byProductLine = [...productMap.values()].sort((a, b) => b.amount - a.amount)
  scorecard.byDiscrepancyType = [...typeMap.values()].sort((a, b) => b.amount - a.amount)
  return scorecard
}

export async function getComplianceControls(scope: DataScope = {}): Promise<ComplianceControls> {
  const db = getSupabaseClient()
  const key = scopeKey(scope)
  const fallback: ComplianceControls = {
    scope_key: key,
    org_id: scope.orgId ?? null,
    user_id: scope.userId ?? null,
    retention_days: 90,
    auto_delete_enabled: false,
    soc2_process_started_at: null,
    evidence_collection_enabled: true,
    data_processing_region: 'us',
    updated_at: new Date().toISOString(),
  }
  if (!db) return fallback
  const { data, error } = await withQueryTimeout(
    db.from('compliance_controls').select('*').eq('scope_key', key).maybeSingle()
  )
  if (error) {
    console.error('[db] getComplianceControls failed:', error)
    return fallback
  }
  return data ? (data as ComplianceControls) : fallback
}

export async function updateComplianceControls(
  scope: DataScope,
  input: Partial<Pick<ComplianceControls, 'retention_days' | 'auto_delete_enabled' | 'soc2_process_started_at' | 'evidence_collection_enabled' | 'data_processing_region'>>
): Promise<ComplianceControls | null> {
  const db = getSupabaseClient()
  if (!db) return null
  const row = {
    scope_key: scopeKey(scope),
    org_id: scope.orgId ?? null,
    user_id: scope.userId ?? null,
    ...input,
    updated_at: new Date().toISOString(),
  }
  const { data, error } = await withQueryTimeout(
    db.from('compliance_controls').upsert(row, { onConflict: 'scope_key' }).select('*').single()
  )
  if (error) {
    console.error('[db] updateComplianceControls failed:', error)
    return null
  }
  return data as ComplianceControls
}

export async function collectComplianceEvidence(scope: DataScope = {}): Promise<number> {
  const db = getSupabaseClient()
  if (!db) return 0
  const controls = await getComplianceControls(scope)
  if (!controls.evidence_collection_enabled) return 0
  const now = new Date().toISOString()
  const rows = [
    {
      org_id: scope.orgId ?? null,
      user_id: scope.userId ?? null,
      evidence_type: 'access_controls',
      control_area: 'security',
      summary: 'Clerk-authenticated routes and role checks are enabled for operational pages.',
      metadata: { collected_at: now },
    },
    {
      org_id: scope.orgId ?? null,
      user_id: scope.userId ?? null,
      evidence_type: 'audit_trail',
      control_area: 'change_management',
      summary: 'Workflow changes and resolution approvals write immutable audit records.',
      metadata: { collected_at: now },
    },
    {
      org_id: scope.orgId ?? null,
      user_id: scope.userId ?? null,
      evidence_type: 'data_retention',
      control_area: 'privacy',
      summary: `Retention policy configured for ${controls.retention_days} days.`,
      metadata: { collected_at: now, auto_delete_enabled: controls.auto_delete_enabled },
    },
  ]
  const { error } = await withQueryTimeout(db.from('compliance_evidence').insert(rows))
  if (error) {
    console.error('[db] collectComplianceEvidence failed:', error)
    return 0
  }
  return rows.length
}

export async function enforceRetention(scope: DataScope = {}): Promise<{ snapshotsDeleted: number; shareLinksRevoked: number }> {
  const db = getSupabaseClient()
  if (!db) return { snapshotsDeleted: 0, shareLinksRevoked: 0 }
  const controls = await getComplianceControls(scope)
  if (!controls.auto_delete_enabled) return { snapshotsDeleted: 0, shareLinksRevoked: 0 }

  const cutoff = new Date(Date.now() - controls.retention_days * 24 * 60 * 60 * 1000).toISOString()
  const schedules = await getReconciliationSchedules(scope)
  const referencedSnapshotIds = new Set(
    schedules.flatMap((schedule) => [
      schedule.charges_snapshot_id,
      schedule.invoices_snapshot_id,
      schedule.fee_schedule_snapshot_id,
    ]).filter(Boolean) as string[]
  )
  const { data: expiredSnapshots, error: expiredSnapshotError } = await withQueryTimeout(
    applyScope(db.from('source_snapshots').select('id').lt('created_at', cutoff), scope)
  )
  if (expiredSnapshotError) console.error('[db] enforceRetention snapshot scan failed:', expiredSnapshotError)
  const deletableSnapshotIds = ((expiredSnapshots ?? []) as { id: string }[])
    .map((row) => row.id)
    .filter((id) => !referencedSnapshotIds.has(id))
  let snapshotsDeleted = 0
  if (deletableSnapshotIds.length > 0) {
    const { data: deletedSnapshots, error: snapshotError } = await withQueryTimeout(
      db.from('source_snapshots').delete().in('id', deletableSnapshotIds).select('id')
    )
    if (snapshotError) console.error('[db] enforceRetention snapshots failed:', snapshotError)
    snapshotsDeleted = deletedSnapshots?.length ?? 0
  }

  const shareQuery = applyScope(
    db
      .from('share_links')
      .update({ revoked_at: new Date().toISOString() })
      .is('revoked_at', null)
      .lt('expires_at', new Date().toISOString())
      .select('id'),
    scope
  )
  const { data: revokedLinks, error: shareError } = await withQueryTimeout(shareQuery)
  if (shareError) console.error('[db] enforceRetention share links failed:', shareError)

  return {
    snapshotsDeleted,
    shareLinksRevoked: revokedLinks?.length ?? 0,
  }
}

export async function createShareLink(input: {
  runId: string
  scope?: DataScope
  createdBy?: string | null
  ttlDays?: number
}): Promise<ShareLink | null> {
  const db = getSupabaseClient()
  if (!db) return null
  const run = await getRunById(input.runId, input.scope ?? {})
  if (!run) return null

  const token = randomBytes(32).toString('base64url')
  const expiresAt = new Date(Date.now() + (input.ttlDays ?? SHARE_LINK_TTL_DAYS) * 24 * 60 * 60 * 1000).toISOString()
  const { data, error } = await withQueryTimeout(
    db
      .from('share_links')
      .insert({
        run_id: input.runId,
        token_hash: hashShareToken(token),
        expires_at: expiresAt,
        created_by: input.createdBy ?? null,
        org_id: input.scope?.orgId ?? null,
        user_id: input.scope?.userId ?? null,
      })
      .select('id, expires_at')
      .single()
  )
  if (error || !data) {
    console.error('[db] createShareLink failed:', error)
    return null
  }
  await logAudit({
    action: 'share_link_created',
    runId: input.runId,
    userId: input.createdBy ?? input.scope?.userId,
    orgId: input.scope?.orgId,
    metadata: { expires_at: expiresAt },
  })
  return {
    id: (data as { id: string }).id,
    token,
    urlPath: `/share/${token}`,
    expiresAt: (data as { expires_at: string }).expires_at,
  }
}

export async function revokeShareLink(token: string): Promise<boolean> {
  const db = getSupabaseClient()
  if (!db) return false
  const { error } = await withQueryTimeout(
    db.from('share_links').update({ revoked_at: new Date().toISOString() }).eq('token_hash', hashShareToken(token))
  )
  if (error) console.error('[db] revokeShareLink failed:', error)
  return !error
}

export async function getRunByShareToken(token: string): Promise<RunDetail | null> {
  const db = getSupabaseClient()
  if (!db) return null
  const { data, error } = await withQueryTimeout(
    db.from('share_links').select('*').eq('token_hash', hashShareToken(token)).maybeSingle()
  )
  if (error || !data) {
    if (error) console.error('[db] getRunByShareToken failed:', error)
    return null
  }

  const link = data as {
    id: string
    run_id: string
    expires_at: string
    revoked_at: string | null
    access_count: number
  }
  if (link.revoked_at || new Date(link.expires_at).getTime() < Date.now()) return null

  await withQueryTimeout(
    db
      .from('share_links')
      .update({ last_accessed_at: new Date().toISOString(), access_count: link.access_count + 1 })
      .eq('id', link.id)
  )
  return getRunById(link.run_id)
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
