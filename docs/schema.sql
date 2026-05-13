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
CREATE INDEX IF NOT EXISTS audit_log_run_id_idx            ON audit_log(run_id);
CREATE INDEX IF NOT EXISTS audit_log_org_id_idx            ON audit_log(org_id);
CREATE INDEX IF NOT EXISTS audit_log_created_at_idx        ON audit_log(created_at);
CREATE INDEX IF NOT EXISTS audit_log_action_idx            ON audit_log(action);

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
