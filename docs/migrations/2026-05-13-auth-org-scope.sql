-- Recona migration: auth/org scoping columns and RLS policies
-- Run this in Supabase SQL Editor against an existing Recona database.

ALTER TABLE reconciliation_runs
  ADD COLUMN IF NOT EXISTS user_id TEXT,
  ADD COLUMN IF NOT EXISTS org_id TEXT;

ALTER TABLE audit_log
  ADD COLUMN IF NOT EXISTS org_id TEXT;

CREATE INDEX IF NOT EXISTS reconciliation_runs_user_id_idx ON reconciliation_runs(user_id);
CREATE INDEX IF NOT EXISTS reconciliation_runs_org_id_idx ON reconciliation_runs(org_id);
CREATE INDEX IF NOT EXISTS audit_log_org_id_idx ON audit_log(org_id);

ALTER TABLE reconciliation_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE discrepancies ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;

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

-- Tell Supabase/PostgREST to refresh its schema cache immediately.
NOTIFY pgrst, 'reload schema';
