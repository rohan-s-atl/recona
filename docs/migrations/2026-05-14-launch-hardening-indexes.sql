-- Recona launch hardening indexes
-- Run after the Phase 2 and Phase 3 migrations.
-- These indexes target the dashboard, queue, analytics, scheduler, and approval desk queries.

CREATE INDEX IF NOT EXISTS reconciliation_runs_org_created_idx
  ON reconciliation_runs(org_id, created_at DESC);

CREATE INDEX IF NOT EXISTS reconciliation_runs_user_created_idx
  ON reconciliation_runs(user_id, created_at DESC)
  WHERE org_id IS NULL;

CREATE INDEX IF NOT EXISTS reconciliation_runs_schedule_created_idx
  ON reconciliation_runs(schedule_id, created_at DESC)
  WHERE schedule_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS discrepancies_run_status_amount_idx
  ON discrepancies(run_id, status, amount_at_risk DESC);

CREATE INDEX IF NOT EXISTS discrepancies_assignee_open_due_idx
  ON discrepancies(assigned_to, due_at, amount_at_risk DESC)
  WHERE status <> 'resolved';

CREATE INDEX IF NOT EXISTS discrepancies_org_lookup_idx
  ON discrepancies(run_id, merchant_id, type);

CREATE INDEX IF NOT EXISTS discrepancies_root_cause_status_idx
  ON discrepancies(root_cause_category, status);

CREATE INDEX IF NOT EXISTS resolution_suggestions_scope_status_created_idx
  ON resolution_suggestions(org_id, user_id, status, created_at DESC);

CREATE INDEX IF NOT EXISTS resolution_suggestions_discrepancy_idx
  ON resolution_suggestions(discrepancy_id);

CREATE INDEX IF NOT EXISTS recovery_ledger_scope_created_idx
  ON recovery_ledger(org_id, user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS recovery_ledger_product_type_idx
  ON recovery_ledger(product_line, discrepancy_type);

CREATE INDEX IF NOT EXISTS source_snapshots_scope_role_created_idx
  ON source_snapshots(org_id, user_id, role, created_at DESC);

CREATE INDEX IF NOT EXISTS source_snapshots_expires_at_idx
  ON source_snapshots(expires_at)
  WHERE expires_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS reconciliation_schedules_due_idx
  ON reconciliation_schedules(enabled, next_run_at)
  WHERE enabled = TRUE;

CREATE INDEX IF NOT EXISTS reconciliation_schedules_lock_idx
  ON reconciliation_schedules(locked_at)
  WHERE locked_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS notification_outbox_delivery_idx
  ON notification_outbox(status, next_attempt_at, attempt_count);

CREATE INDEX IF NOT EXISTS audit_log_scope_created_idx
  ON audit_log(org_id, user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS compliance_evidence_scope_created_idx
  ON compliance_evidence(org_id, user_id, created_at DESC);
