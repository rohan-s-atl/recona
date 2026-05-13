-- Recona — V2 Migration: Auth columns for Clerk integration
-- Run this against your Supabase project after schema.sql

-- ── Add user_id and org_id to reconciliation_runs ──────────────────────────────

ALTER TABLE reconciliation_runs
  ADD COLUMN IF NOT EXISTS user_id TEXT,
  ADD COLUMN IF NOT EXISTS org_id  TEXT;

-- ── Add org_id to audit_log (user_id already exists) ──────────────────────────

ALTER TABLE audit_log
  ADD COLUMN IF NOT EXISTS org_id TEXT;

-- ── Indexes ────────────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS reconciliation_runs_user_id_idx ON reconciliation_runs(user_id);
CREATE INDEX IF NOT EXISTS reconciliation_runs_org_id_idx  ON reconciliation_runs(org_id);
CREATE INDEX IF NOT EXISTS audit_log_org_id_idx            ON audit_log(org_id);

-- ── Row Level Security — enable after wiring Clerk JWT to Supabase ─────────────
--
-- Step 1: In Clerk Dashboard → JWT Templates → New template → name it "supabase"
--   Add claim:  { "org_id": "{{org.id}}" }
--   Copy the Signing Key from the template page.
--
-- Step 2: In Supabase Dashboard → Project Settings → API → JWT Settings
--   Paste the Clerk Signing Key as the JWT Secret.
--
-- Step 3: In your app, create a Supabase client using the Clerk JWT token:
--   const supabaseToken = await session.getToken({ template: 'supabase' })
--   const db = createClient(url, anonKey, {
--     global: { headers: { Authorization: `Bearer ${supabaseToken}` } }
--   })
--
-- Step 4: Uncomment and run the policies below.

-- ALTER TABLE reconciliation_runs ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE discrepancies        ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE audit_log            ENABLE ROW LEVEL SECURITY;

-- Org-scoped read: users in the same org can read each other's runs
-- CREATE POLICY "org_read_runs" ON reconciliation_runs
--   FOR SELECT USING (
--     org_id = (auth.jwt() ->> 'org_id')
--     OR org_id IS NULL
--   );

-- CREATE POLICY "org_insert_runs" ON reconciliation_runs
--   FOR INSERT WITH CHECK (
--     org_id = (auth.jwt() ->> 'org_id')
--   );

-- Discrepancies are scoped through their parent run
-- CREATE POLICY "org_read_discrepancies" ON discrepancies
--   FOR SELECT USING (
--     run_id IN (
--       SELECT id FROM reconciliation_runs
--       WHERE org_id = (auth.jwt() ->> 'org_id') OR org_id IS NULL
--     )
--   );

-- CREATE POLICY "org_insert_discrepancies" ON discrepancies
--   FOR INSERT WITH CHECK (
--     run_id IN (SELECT id FROM reconciliation_runs WHERE org_id = (auth.jwt() ->> 'org_id'))
--   );

-- Audit log: org-scoped read, no delete ever
-- CREATE POLICY "org_read_audit_log" ON audit_log
--   FOR SELECT USING (
--     org_id = (auth.jwt() ->> 'org_id')
--     OR org_id IS NULL
--   );

-- CREATE POLICY "org_insert_audit_log" ON audit_log
--   FOR INSERT WITH CHECK (
--     org_id = (auth.jwt() ->> 'org_id')
--   );

-- Non-deletable audit trail
-- CREATE POLICY "audit_log_no_delete" ON audit_log
--   FOR DELETE USING (false);
