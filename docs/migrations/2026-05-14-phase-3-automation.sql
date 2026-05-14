-- Recona migration: Phase 3 automation, recovery, and compliance
-- Run after 2026-05-14-phase-2-workflow.sql.

CREATE TABLE IF NOT EXISTS source_snapshots (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  org_id          TEXT,
  user_id         TEXT,
  role            TEXT        NOT NULL CHECK (role IN ('charges','invoices','fee_schedule')),
  name            TEXT        NOT NULL,
  filename        TEXT        NOT NULL,
  headers         JSONB       NOT NULL DEFAULT '[]'::jsonb,
  rows            JSONB       NOT NULL DEFAULT '[]'::jsonb,
  row_count       INTEGER     NOT NULL DEFAULT 0,
  mapping         JSONB,
  checksum        TEXT,
  expires_at      TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS source_snapshots_scope_idx ON source_snapshots(org_id, user_id);
CREATE INDEX IF NOT EXISTS source_snapshots_role_idx ON source_snapshots(role);
CREATE INDEX IF NOT EXISTS source_snapshots_expires_at_idx ON source_snapshots(expires_at);

CREATE TABLE IF NOT EXISTS reconciliation_schedules (
  id                    UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  org_id                TEXT,
  user_id               TEXT,
  name                  TEXT        NOT NULL,
  cadence               TEXT        NOT NULL CHECK (cadence IN ('daily','weekly','monthly')),
  timezone              TEXT        NOT NULL DEFAULT 'America/New_York',
  run_at_local          TEXT        NOT NULL DEFAULT '09:00',
  product_line          TEXT,
  catch_fast_enabled    BOOLEAN     NOT NULL DEFAULT FALSE,
  rolling_window_days   INTEGER     NOT NULL DEFAULT 3,
  charges_snapshot_id   UUID        NOT NULL REFERENCES source_snapshots(id),
  invoices_snapshot_id  UUID        NOT NULL REFERENCES source_snapshots(id),
  fee_schedule_snapshot_id UUID     REFERENCES source_snapshots(id),
  charges_mapping       JSONB       NOT NULL,
  invoices_mapping      JSONB       NOT NULL,
  enabled               BOOLEAN     NOT NULL DEFAULT TRUE,
  last_run_at           TIMESTAMPTZ,
  next_run_at           TIMESTAMPTZ NOT NULL,
  last_run_id           UUID        REFERENCES reconciliation_runs(id),
  last_error            TEXT,
  locked_at             TIMESTAMPTZ,
  locked_by             TEXT,
  run_count             INTEGER     NOT NULL DEFAULT 0,
  failure_count         INTEGER     NOT NULL DEFAULT 0
);

ALTER TABLE reconciliation_schedules
  ADD COLUMN IF NOT EXISTS locked_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS locked_by TEXT,
  ADD COLUMN IF NOT EXISTS run_count INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS failure_count INTEGER NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS reconciliation_schedules_due_idx ON reconciliation_schedules(enabled, next_run_at);
CREATE INDEX IF NOT EXISTS reconciliation_schedules_scope_idx ON reconciliation_schedules(org_id, user_id);
CREATE INDEX IF NOT EXISTS reconciliation_schedules_lock_idx ON reconciliation_schedules(locked_at);

ALTER TABLE reconciliation_runs
  ADD COLUMN IF NOT EXISTS schedule_id UUID REFERENCES reconciliation_schedules(id);

CREATE TABLE IF NOT EXISTS resolution_suggestions (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  run_id              UUID        NOT NULL REFERENCES reconciliation_runs(id) ON DELETE CASCADE,
  discrepancy_id      UUID        NOT NULL REFERENCES discrepancies(id) ON DELETE CASCADE,
  org_id              TEXT,
  user_id             TEXT,
  suggestion_type     TEXT        NOT NULL CHECK (suggestion_type IN ('draft_invoice','issue_credit','provision_product','deactivate_account','correct_rate','review_manually')),
  confidence_score    NUMERIC(5,4) NOT NULL DEFAULT 0.75,
  title               TEXT        NOT NULL,
  proposed_action     TEXT        NOT NULL,
  payload             JSONB       NOT NULL DEFAULT '{}'::jsonb,
  status              TEXT        NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected','applied')),
  approved_by         TEXT,
  approved_at         TIMESTAMPTZ,
  rejected_by         TEXT,
  rejected_at         TIMESTAMPTZ
);

CREATE UNIQUE INDEX IF NOT EXISTS resolution_suggestions_discrepancy_idx ON resolution_suggestions(discrepancy_id);
CREATE INDEX IF NOT EXISTS resolution_suggestions_status_idx ON resolution_suggestions(status);

CREATE TABLE IF NOT EXISTS recovery_ledger (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  run_id              UUID        REFERENCES reconciliation_runs(id),
  discrepancy_id      UUID        REFERENCES discrepancies(id),
  suggestion_id       UUID        REFERENCES resolution_suggestions(id),
  org_id              TEXT,
  user_id             TEXT,
  approved_by         TEXT,
  recovery_type       TEXT        NOT NULL CHECK (recovery_type IN ('underbilled_recovered','overbilling_reversed','waived','escalated')),
  product_line        TEXT,
  discrepancy_type    TEXT,
  amount              NUMERIC(14,2) NOT NULL DEFAULT 0,
  currency            TEXT        NOT NULL DEFAULT 'USD',
  note                TEXT
);

CREATE INDEX IF NOT EXISTS recovery_ledger_scope_idx ON recovery_ledger(org_id, user_id);
CREATE INDEX IF NOT EXISTS recovery_ledger_created_at_idx ON recovery_ledger(created_at);
CREATE INDEX IF NOT EXISTS recovery_ledger_product_line_idx ON recovery_ledger(product_line);
CREATE UNIQUE INDEX IF NOT EXISTS recovery_ledger_suggestion_idx ON recovery_ledger(suggestion_id);

CREATE TABLE IF NOT EXISTS compliance_controls (
  scope_key               TEXT        PRIMARY KEY,
  org_id                  TEXT,
  user_id                 TEXT,
  retention_days          INTEGER     NOT NULL DEFAULT 90,
  auto_delete_enabled     BOOLEAN     NOT NULL DEFAULT FALSE,
  soc2_process_started_at TIMESTAMPTZ,
  evidence_collection_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  data_processing_region  TEXT        NOT NULL DEFAULT 'us',
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS compliance_evidence (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  org_id          TEXT,
  user_id         TEXT,
  evidence_type   TEXT        NOT NULL,
  control_area    TEXT        NOT NULL,
  summary         TEXT        NOT NULL,
  metadata        JSONB       NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS compliance_evidence_scope_idx ON compliance_evidence(org_id, user_id);
CREATE INDEX IF NOT EXISTS compliance_evidence_created_at_idx ON compliance_evidence(created_at);

ALTER TABLE source_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE reconciliation_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE resolution_suggestions ENABLE ROW LEVEL SECURITY;
ALTER TABLE recovery_ledger ENABLE ROW LEVEL SECURITY;
ALTER TABLE compliance_controls ENABLE ROW LEVEL SECURITY;
ALTER TABLE compliance_evidence ENABLE ROW LEVEL SECURITY;

-- Server-side service-role API writes bypass RLS. These policies document tenant boundaries for direct clients.
DROP POLICY IF EXISTS source_snapshots_select_scope ON source_snapshots;
CREATE POLICY source_snapshots_select_scope ON source_snapshots FOR SELECT USING (
  org_id = auth.jwt() ->> 'org_id' OR (org_id IS NULL AND user_id = auth.jwt() ->> 'sub')
);

DROP POLICY IF EXISTS reconciliation_schedules_select_scope ON reconciliation_schedules;
CREATE POLICY reconciliation_schedules_select_scope ON reconciliation_schedules FOR SELECT USING (
  org_id = auth.jwt() ->> 'org_id' OR (org_id IS NULL AND user_id = auth.jwt() ->> 'sub')
);

DROP POLICY IF EXISTS resolution_suggestions_select_scope ON resolution_suggestions;
CREATE POLICY resolution_suggestions_select_scope ON resolution_suggestions FOR SELECT USING (
  org_id = auth.jwt() ->> 'org_id' OR (org_id IS NULL AND user_id = auth.jwt() ->> 'sub')
);

DROP POLICY IF EXISTS recovery_ledger_select_scope ON recovery_ledger;
CREATE POLICY recovery_ledger_select_scope ON recovery_ledger FOR SELECT USING (
  org_id = auth.jwt() ->> 'org_id' OR (org_id IS NULL AND user_id = auth.jwt() ->> 'sub')
);

DROP POLICY IF EXISTS compliance_controls_select_scope ON compliance_controls;
CREATE POLICY compliance_controls_select_scope ON compliance_controls FOR SELECT USING (
  org_id = auth.jwt() ->> 'org_id' OR (org_id IS NULL AND user_id = auth.jwt() ->> 'sub')
);

DROP POLICY IF EXISTS compliance_evidence_select_scope ON compliance_evidence;
CREATE POLICY compliance_evidence_select_scope ON compliance_evidence FOR SELECT USING (
  org_id = auth.jwt() ->> 'org_id' OR (org_id IS NULL AND user_id = auth.jwt() ->> 'sub')
);

NOTIFY pgrst, 'reload schema';
