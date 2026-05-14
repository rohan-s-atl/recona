-- Recona - Postgres Schema
-- Run against your Supabase project via the SQL editor.

-- Tables

CREATE TABLE IF NOT EXISTS reconciliation_runs (
  id                      UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at              TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  user_id                 TEXT,
  org_id                  TEXT,
  charges_filename        TEXT          NOT NULL,
  invoices_filename       TEXT          NOT NULL,
  fee_schedule_filename   TEXT,
  has_fee_schedule        BOOLEAN       NOT NULL DEFAULT FALSE,
  total_charges_records   INTEGER       NOT NULL DEFAULT 0,
  total_invoices_records  INTEGER       NOT NULL DEFAULT 0,
  exact_matches           INTEGER       NOT NULL DEFAULT 0,
  fuzzy_matches           INTEGER       NOT NULL DEFAULT 0,
  discrepancy_count       INTEGER       NOT NULL DEFAULT 0,
  total_amount_at_risk    NUMERIC(14,2) NOT NULL DEFAULT 0,
  total_overbilled        NUMERIC(14,2) NOT NULL DEFAULT 0,
  total_underbilled       NUMERIC(14,2) NOT NULL DEFAULT 0,
  ai_summary              TEXT,
  merchant_summaries      JSONB,
  product_line_summaries  JSONB
);

CREATE TABLE IF NOT EXISTS discrepancies (
  id                  UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id              UUID          NOT NULL REFERENCES reconciliation_runs(id) ON DELETE CASCADE,
  created_at          TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  type                TEXT          NOT NULL,
  severity            TEXT          NOT NULL CHECK (severity IN ('critical','high','medium','low')),
  amount_at_risk      NUMERIC(14,2) NOT NULL DEFAULT 0,
  direction           TEXT          NOT NULL CHECK (direction IN ('under_billed','over_billed','missing')),
  merchant_id         TEXT          NOT NULL,
  merchant_name       TEXT          NOT NULL,
  product_line        TEXT,
  ai_reason           TEXT,
  root_cause          TEXT,
  root_cause_category TEXT          NOT NULL DEFAULT 'unclassified'
                    CHECK (root_cause_category IN ('provisioning_gap','rate_table_error','plan_sync_failure','account_lifecycle_failure','proration_logic_mismatch','manual_override_not_propagated','data_sync_failure','duplicate_record','unclassified')),
  status              TEXT          NOT NULL DEFAULT 'open'
                    CHECK (status IN ('open','in_review','resolved')),
  assigned_to         TEXT,
  assigned_by         TEXT,
  assignment_note     TEXT,
  assigned_at         TIMESTAMPTZ,
  due_at              TIMESTAMPTZ,
  resolution_type     TEXT
                    CHECK (resolution_type IS NULL OR resolution_type IN ('corrected','waived','duplicate','escalated')),
  resolution_comment  TEXT,
  resolved_by         TEXT,
  resolved_at         TIMESTAMPTZ,
  confidence_score    NUMERIC(5,4),
  charges_record      JSONB,
  invoices_record     JSONB,
  fee_schedule_record JSONB
);

CREATE TABLE IF NOT EXISTS audit_log (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  action          TEXT        NOT NULL,
  run_id          UUID        REFERENCES reconciliation_runs(id),
  discrepancy_id  UUID        REFERENCES discrepancies(id),
  user_id         TEXT,
  org_id          TEXT,
  ip_address      TEXT,
  metadata        JSONB
);

-- Indexes

CREATE INDEX IF NOT EXISTS reconciliation_runs_user_id_idx ON reconciliation_runs(user_id);
CREATE INDEX IF NOT EXISTS reconciliation_runs_org_id_idx  ON reconciliation_runs(org_id);
CREATE INDEX IF NOT EXISTS discrepancies_run_id_idx        ON discrepancies(run_id);
CREATE INDEX IF NOT EXISTS discrepancies_type_idx          ON discrepancies(type);
CREATE INDEX IF NOT EXISTS discrepancies_merchant_id_idx   ON discrepancies(merchant_id);
CREATE INDEX IF NOT EXISTS discrepancies_severity_idx      ON discrepancies(severity);
CREATE INDEX IF NOT EXISTS discrepancies_status_idx        ON discrepancies(status);
CREATE INDEX IF NOT EXISTS discrepancies_assigned_to_idx   ON discrepancies(assigned_to);
CREATE INDEX IF NOT EXISTS discrepancies_due_at_idx        ON discrepancies(due_at);
CREATE INDEX IF NOT EXISTS discrepancies_root_cause_idx    ON discrepancies(root_cause_category);
CREATE INDEX IF NOT EXISTS audit_log_run_id_idx            ON audit_log(run_id);
CREATE INDEX IF NOT EXISTS audit_log_org_id_idx            ON audit_log(org_id);
CREATE INDEX IF NOT EXISTS audit_log_created_at_idx        ON audit_log(created_at);
CREATE INDEX IF NOT EXISTS audit_log_action_idx            ON audit_log(action);

CREATE TABLE IF NOT EXISTS organization_settings (
  scope_key                  TEXT        PRIMARY KEY,
  org_id                     TEXT,
  user_id                    TEXT,
  alert_threshold_cents      INTEGER     NOT NULL DEFAULT 50000,
  slack_webhook_url          TEXT,
  slack_channel              TEXT,
  weekly_digest_enabled      BOOLEAN     NOT NULL DEFAULT TRUE,
  email_alerts_enabled       BOOLEAN     NOT NULL DEFAULT TRUE,
  slack_alerts_enabled       BOOLEAN     NOT NULL DEFAULT FALSE,
  created_at                 TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                 TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS notification_outbox (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  sent_at         TIMESTAMPTZ,
  next_attempt_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  attempt_count   INTEGER     NOT NULL DEFAULT 0,
  channel         TEXT        NOT NULL CHECK (channel IN ('email','slack')),
  event_type      TEXT        NOT NULL,
  recipient       TEXT,
  run_id          UUID        REFERENCES reconciliation_runs(id),
  discrepancy_id  UUID        REFERENCES discrepancies(id),
  org_id          TEXT,
  user_id         TEXT,
  payload         JSONB       NOT NULL DEFAULT '{}'::jsonb,
  status          TEXT        NOT NULL DEFAULT 'queued' CHECK (status IN ('queued','sent','failed','skipped')),
  error           TEXT
);

CREATE INDEX IF NOT EXISTS notification_outbox_status_idx ON notification_outbox(status);
CREATE INDEX IF NOT EXISTS notification_outbox_org_id_idx ON notification_outbox(org_id);
CREATE INDEX IF NOT EXISTS notification_outbox_next_attempt_idx ON notification_outbox(next_attempt_at);

CREATE TABLE IF NOT EXISTS share_links (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at      TIMESTAMPTZ NOT NULL,
  revoked_at      TIMESTAMPTZ,
  token_hash      TEXT        NOT NULL UNIQUE,
  run_id          UUID        NOT NULL REFERENCES reconciliation_runs(id) ON DELETE CASCADE,
  created_by      TEXT,
  org_id          TEXT,
  user_id         TEXT,
  last_accessed_at TIMESTAMPTZ,
  access_count    INTEGER     NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS share_links_token_hash_idx ON share_links(token_hash);
CREATE INDEX IF NOT EXISTS share_links_run_id_idx ON share_links(run_id);
CREATE INDEX IF NOT EXISTS share_links_expires_at_idx ON share_links(expires_at);

CREATE TABLE IF NOT EXISTS ai_audit_log (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  event           TEXT        NOT NULL,
  model           TEXT,
  run_id          UUID        REFERENCES reconciliation_runs(id),
  discrepancy_id  UUID        REFERENCES discrepancies(id),
  user_id         TEXT,
  org_id          TEXT,
  prompt_hash     TEXT,
  input_summary   JSONB       NOT NULL DEFAULT '{}'::jsonb,
  output_summary  JSONB       NOT NULL DEFAULT '{}'::jsonb,
  confidence_score NUMERIC(5,4),
  latency_ms      INTEGER,
  status          TEXT        NOT NULL DEFAULT 'ok' CHECK (status IN ('ok','failed','skipped'))
);

CREATE INDEX IF NOT EXISTS ai_audit_log_event_idx ON ai_audit_log(event);
CREATE INDEX IF NOT EXISTS ai_audit_log_run_id_idx ON ai_audit_log(run_id);
CREATE INDEX IF NOT EXISTS ai_audit_log_org_id_idx ON ai_audit_log(org_id);

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

-- Row-level security
-- These policies expect Clerk JWTs to include:
--   org_id: active organization id
--   sub: Clerk user id
-- The server-side service-role key bypasses RLS for API writes, but these policies
-- protect direct Supabase client usage and document the tenant boundary.

ALTER TABLE reconciliation_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE discrepancies        ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_log            ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS reconciliation_runs_select_scope ON reconciliation_runs;
CREATE POLICY reconciliation_runs_select_scope ON reconciliation_runs
  FOR SELECT
  USING (
    org_id = auth.jwt() ->> 'org_id'
    OR (org_id IS NULL AND user_id = auth.jwt() ->> 'sub')
  );

DROP POLICY IF EXISTS reconciliation_runs_insert_scope ON reconciliation_runs;
CREATE POLICY reconciliation_runs_insert_scope ON reconciliation_runs
  FOR INSERT
  WITH CHECK (
    org_id = auth.jwt() ->> 'org_id'
    OR (org_id IS NULL AND user_id = auth.jwt() ->> 'sub')
  );

DROP POLICY IF EXISTS discrepancies_select_scope ON discrepancies;
CREATE POLICY discrepancies_select_scope ON discrepancies
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM reconciliation_runs r
      WHERE r.id = discrepancies.run_id
        AND (
          r.org_id = auth.jwt() ->> 'org_id'
          OR (r.org_id IS NULL AND r.user_id = auth.jwt() ->> 'sub')
        )
    )
  );

DROP POLICY IF EXISTS discrepancies_insert_scope ON discrepancies;
CREATE POLICY discrepancies_insert_scope ON discrepancies
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM reconciliation_runs r
      WHERE r.id = discrepancies.run_id
        AND (
          r.org_id = auth.jwt() ->> 'org_id'
          OR (r.org_id IS NULL AND r.user_id = auth.jwt() ->> 'sub')
        )
    )
  );

DROP POLICY IF EXISTS discrepancies_update_scope ON discrepancies;
CREATE POLICY discrepancies_update_scope ON discrepancies
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1
      FROM reconciliation_runs r
      WHERE r.id = discrepancies.run_id
        AND (
          r.org_id = auth.jwt() ->> 'org_id'
          OR (r.org_id IS NULL AND r.user_id = auth.jwt() ->> 'sub')
        )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM reconciliation_runs r
      WHERE r.id = discrepancies.run_id
        AND (
          r.org_id = auth.jwt() ->> 'org_id'
          OR (r.org_id IS NULL AND r.user_id = auth.jwt() ->> 'sub')
        )
    )
  );

DROP POLICY IF EXISTS audit_log_select_scope ON audit_log;
CREATE POLICY audit_log_select_scope ON audit_log
  FOR SELECT
  USING (
    org_id = auth.jwt() ->> 'org_id'
    OR (org_id IS NULL AND user_id = auth.jwt() ->> 'sub')
  );

DROP POLICY IF EXISTS audit_log_insert_scope ON audit_log;
CREATE POLICY audit_log_insert_scope ON audit_log
  FOR INSERT
  WITH CHECK (
    org_id = auth.jwt() ->> 'org_id'
    OR (org_id IS NULL AND user_id = auth.jwt() ->> 'sub')
  );

DROP POLICY IF EXISTS audit_log_no_delete ON audit_log;
CREATE POLICY audit_log_no_delete ON audit_log
  FOR DELETE
  USING (false);

ALTER TABLE organization_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_outbox ENABLE ROW LEVEL SECURITY;
ALTER TABLE share_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_audit_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS organization_settings_select_scope ON organization_settings;
CREATE POLICY organization_settings_select_scope ON organization_settings
  FOR SELECT
  USING (
    org_id = auth.jwt() ->> 'org_id'
    OR (org_id IS NULL AND user_id = auth.jwt() ->> 'sub')
  );

DROP POLICY IF EXISTS organization_settings_mutate_scope ON organization_settings;
CREATE POLICY organization_settings_mutate_scope ON organization_settings
  FOR ALL
  USING (
    org_id = auth.jwt() ->> 'org_id'
    OR (org_id IS NULL AND user_id = auth.jwt() ->> 'sub')
  )
  WITH CHECK (
    org_id = auth.jwt() ->> 'org_id'
    OR (org_id IS NULL AND user_id = auth.jwt() ->> 'sub')
  );

DROP POLICY IF EXISTS notification_outbox_select_scope ON notification_outbox;
CREATE POLICY notification_outbox_select_scope ON notification_outbox
  FOR SELECT
  USING (
    org_id = auth.jwt() ->> 'org_id'
    OR (org_id IS NULL AND user_id = auth.jwt() ->> 'sub')
  );

DROP POLICY IF EXISTS share_links_select_scope ON share_links;
CREATE POLICY share_links_select_scope ON share_links
  FOR SELECT
  USING (
    org_id = auth.jwt() ->> 'org_id'
    OR (org_id IS NULL AND user_id = auth.jwt() ->> 'sub')
  );

DROP POLICY IF EXISTS ai_audit_log_select_scope ON ai_audit_log;
CREATE POLICY ai_audit_log_select_scope ON ai_audit_log
  FOR SELECT
  USING (
    org_id = auth.jwt() ->> 'org_id'
    OR (org_id IS NULL AND user_id = auth.jwt() ->> 'sub')
  );
