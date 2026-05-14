-- Recona migration: Phase 2 workflow intelligence
-- Run this in Supabase SQL Editor against an existing Recona database.

ALTER TABLE discrepancies
  ADD COLUMN IF NOT EXISTS root_cause_category TEXT NOT NULL DEFAULT 'unclassified',
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'open',
  ADD COLUMN IF NOT EXISTS assigned_to TEXT,
  ADD COLUMN IF NOT EXISTS assigned_by TEXT,
  ADD COLUMN IF NOT EXISTS assignment_note TEXT,
  ADD COLUMN IF NOT EXISTS assigned_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS due_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS resolution_type TEXT,
  ADD COLUMN IF NOT EXISTS resolution_comment TEXT,
  ADD COLUMN IF NOT EXISTS resolved_by TEXT,
  ADD COLUMN IF NOT EXISTS resolved_at TIMESTAMPTZ;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'discrepancies_root_cause_category_check') THEN
    ALTER TABLE discrepancies
      ADD CONSTRAINT discrepancies_root_cause_category_check
      CHECK (root_cause_category IN ('provisioning_gap','rate_table_error','plan_sync_failure','account_lifecycle_failure','proration_logic_mismatch','manual_override_not_propagated','data_sync_failure','duplicate_record','unclassified'));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'discrepancies_status_check') THEN
    ALTER TABLE discrepancies
      ADD CONSTRAINT discrepancies_status_check CHECK (status IN ('open','in_review','resolved'));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'discrepancies_resolution_type_check') THEN
    ALTER TABLE discrepancies
      ADD CONSTRAINT discrepancies_resolution_type_check
      CHECK (resolution_type IS NULL OR resolution_type IN ('corrected','waived','duplicate','escalated'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS discrepancies_status_idx ON discrepancies(status);
CREATE INDEX IF NOT EXISTS discrepancies_assigned_to_idx ON discrepancies(assigned_to);
CREATE INDEX IF NOT EXISTS discrepancies_due_at_idx ON discrepancies(due_at);
CREATE INDEX IF NOT EXISTS discrepancies_root_cause_idx ON discrepancies(root_cause_category);

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

ALTER TABLE notification_outbox
  ADD COLUMN IF NOT EXISTS next_attempt_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS attempt_count INTEGER NOT NULL DEFAULT 0;

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

NOTIFY pgrst, 'reload schema';
