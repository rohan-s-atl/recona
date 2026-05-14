export type FileRole = 'charges' | 'invoices' | 'fee_schedule'

export interface ColumnMapping {
  record_id: string | null
  client_id: string | null
  client_name: string | null
  product_line: string | null
  product_name: string | null
  fee_type: string | null
  amount: string | null
  billing_period: string | null
  date: string | null
  transaction_volume: string | null
  account_status: string | null
}

// ── Fee Schedule ────────────────────────────────────────────────────────────

export interface FeeScheduleRecord {
  merchant_id: string
  merchant_name: string
  product_line: string
  product_name: string
  fee_type: string
  rate_type: 'flat' | 'percentage'
  contracted_rate: number
  effective_date: string
}

// ── Normalized ──────────────────────────────────────────────────────────────

export interface NormalizedRecord {
  _sourceRow: number
  _fileRole: 'charges' | 'invoices'
  record_id: string
  client_id: string
  client_name: string
  product_line: string
  product_name: string
  fee_type: string
  amount: number
  billing_period: string
  date: string
  transaction_volume: number | null
  account_status: string
  _raw: Record<string, string>
}

// ── Discrepancy ──────────────────────────────────────────────────────────────

export type DiscrepancyType =
  | 'missing_from_billing'       // charged, never invoiced
  | 'missing_from_charges'       // invoiced, no charge record (phantom / overbilled)
  | 'rate_mismatch'              // billed at wrong processing % rate
  | 'plan_mismatch'              // billed at wrong product tier (e.g. Core vs Pro)
  | 'amount_mismatch'            // same product, wrong dollar amount
  | 'missing_contracted_fee'     // fee in contract not appearing in billing
  | 'closed_account_billed'      // account deactivated, billing continued
  | 'proration_error'            // mid-cycle onboard billed full period
  | 'duplicate_invoice'
  | 'name_variation_flagged'     // AI-resolved name mismatch, low confidence

export type DiscrepancySeverity = 'critical' | 'high' | 'medium' | 'low'
export type DiscrepancyStatus = 'open' | 'in_review' | 'resolved'
export type ResolutionType = 'corrected' | 'waived' | 'duplicate' | 'escalated'
export type ReconciliationCadence = 'daily' | 'weekly' | 'monthly'
export type ResolutionSuggestionType =
  | 'draft_invoice'
  | 'issue_credit'
  | 'provision_product'
  | 'deactivate_account'
  | 'correct_rate'
  | 'review_manually'
export type RootCauseCategory =
  | 'provisioning_gap'
  | 'rate_table_error'
  | 'plan_sync_failure'
  | 'account_lifecycle_failure'
  | 'proration_logic_mismatch'
  | 'manual_override_not_propagated'
  | 'data_sync_failure'
  | 'duplicate_record'
  | 'unclassified'

export interface Discrepancy {
  id: string
  type: DiscrepancyType
  severity: DiscrepancySeverity
  status?: DiscrepancyStatus
  assignedTo?: string | null
  assignmentNote?: string | null
  dueAt?: string | null
  resolutionType?: ResolutionType | null
  resolutionComment?: string | null
  resolvedAt?: string | null
  rootCauseCategory?: RootCauseCategory | null
  amountAtRisk: number
  /** Positive = revenue leaked (underbilled). Negative = overbilled to merchant. */
  direction: 'under_billed' | 'over_billed' | 'missing'
  chargesRecord: NormalizedRecord | null
  invoicesRecord: NormalizedRecord | null
  feeScheduleRecord: FeeScheduleRecord | null
  confidenceScore: number
  aiReason: string
  rootCause: string
  productLine: string
  merchantId: string
  merchantName: string
}

// ── Matching ─────────────────────────────────────────────────────────────────

export interface MatchResult {
  chargesRecord: NormalizedRecord
  invoicesRecord: NormalizedRecord
  matchType: 'exact' | 'fuzzy'
  confidenceScore: number
  aiReason?: string
}

// ── Merchant bundle ───────────────────────────────────────────────────────────

export interface MerchantSummary {
  merchantId: string
  merchantName: string
  totalCharged: number
  totalBilled: number
  totalAtRisk: number
  discrepancyCount: number
  discrepancies: Discrepancy[]
}

// ── Product line summary ──────────────────────────────────────────────────────

export interface ProductLineSummary {
  productLine: string
  totalAtRisk: number
  discrepancyCount: number
  types: Partial<Record<DiscrepancyType, number>>
}

// ── Reconciliation result ─────────────────────────────────────────────────────

export interface ReconciliationResult {
  runId: string
  ranAt: string
  /** True when the run was successfully persisted to Postgres */
  persisted?: boolean
  totalChargesRecords: number
  totalInvoicesRecords: number
  hasFeeSchedule: boolean
  exactMatches: number
  fuzzyMatches: number
  discrepancyCount: number
  totalAmountAtRisk: number
  /** Revenue that exists in billing but not charges (overbilled to merchants) */
  totalOverbilled: number
  /** Revenue in charges but not billing (leaked) */
  totalUnderbilled: number
  matches: MatchResult[]
  discrepancies: Discrepancy[]
  merchantSummaries: MerchantSummary[]
  productLineSummaries: ProductLineSummary[]
  aiSummary: string
}

// ── API shapes ────────────────────────────────────────────────────────────────

export interface UploadApiResponse {
  fileId: string
  filename: string
  sizeBytes: number
  headers: string[]
  sample: Record<string, string>[]
  rowsCount: number
  suggestedMapping: ColumnMapping
}

export interface FeeScheduleUploadResponse {
  fileId: string
  filename: string
  records: FeeScheduleRecord[]
  merchantCount: number
  productCount: number
}

export interface ReconcileApiRequest {
  chargesFileId: string
  invoicesFileId: string
  chargesMapping: ColumnMapping
  invoicesMapping: ColumnMapping
  feeScheduleFileId?: string
}
