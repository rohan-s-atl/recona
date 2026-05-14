# Recona — Engineering Roadmap

---

## What we're building

Payment processors and fintech platforms operate dozens of product lines billed to thousands or millions of merchants every month. The billing engine, the account management system, and the contract database are almost always separate systems maintained by separate teams. Data gets out of sync constantly — not because of negligence, but because the systems were never designed to stay in sync across the full product lifecycle.

The result is systematic, silent revenue leakage. Merchants contracted for one plan billed at another. Processing rates provisioned incorrectly at onboarding and never caught. Add-on products enrolled in CRM but never activated in the billing engine. Closed accounts billed for months after deactivation. None of this shows up as an error. It just accumulates.

Recona is the reconciliation layer between what is contracted, what is charged, and what is billed — running automatically, surfacing everything, and closing the loop.

---

## Phase 0 — Foundation ✅ Complete

### What was built
- Monorepo (`/frontend`, `/backend`, `/ai`, `/docs`)
- 3-file upload flow: product charges + billing invoices + optional fee schedule (contracted rates)
- Claude AI column mapping → merchant+fee_type exact matching → fuzzy matching → rate/plan mismatch detection
- 9 discrepancy types: `missing_from_billing`, `missing_from_charges`, `rate_mismatch`, `plan_mismatch`, `amount_mismatch`, `missing_contracted_fee`, `closed_account_billed`, `proration_error`, `duplicate_invoice`
- 3-tab results view: By Merchant, All Issues, By Product Line
- Claude Sonnet executive summary after every run

### Fictional product suite (test data)
Designed to mirror real payment processor product lines without copying them exactly:

| Product | Description | Analog |
|---|---|---|
| Apex POS (Lite / Core / Pro / Enterprise) | Merchant point-of-sale platform | Clover POS |
| FlowPay Processing | Merchant payment processing (% of volume) | Clover Payments |
| ShieldNet (Basic / Advanced) | PCI compliance and fraud protection | Clover Security |
| LoyaltyLoop (Starter / Pro) | Customer loyalty and retention platform | Clover Rewards |
| InsightIQ (Standard / Advanced) | Merchant analytics and reporting | Main Street Insights |
| WebCharge Terminal | Web-based virtual payment terminal | Clover Virtual Terminal |
| Nexus Commerce | Enterprise payments orchestration (custom) | Carat |
| ClearCore Banking Suite | Banking core infrastructure (custom) | DNA |

---

## Phase 1 — Production MVP (Weeks 1–10)

**Goal:** Every reconciliation run is persisted, auditable, exportable, and gated behind auth. The engine handles large files without blocking the UI.

### Week 1–3 ✅ Complete
- [x] File upload engine (CSV + Excel, AI column mapping, normalization)
- [x] Matching engine (merchant+fee_type aware, exact + fuzzy)
- [x] Rate and plan mismatch detection (contracted rate vs billed amount)
- [x] Missing contracted fee detection (contract not appearing in billing)
- [x] Multi-tab results: By Merchant, By Product Line, All Issues

### Week 4–5 ✅ Complete
- [x] Postgres schema via Supabase — `reconciliation_runs`, `discrepancies`, `audit_log`
- [x] Reconcile API persists every run and all discrepancies to DB
- [x] Run history page (`/runs`) — list of past runs with summary stats
- [x] Run detail page (`/runs/[id]`) — full results, persistent URL shareable with team
- [x] PDF export — print CSS, all result sections rendered for print
- [x] Glassmorphism UI redesign — Apple system fonts, frosted glass panels, ambient gradient background

### Week 6 - Auth and Access Control - Complete
- [x] Clerk authentication - email + password, Google SSO
- [x] Role-based access: Admin (audit/export/configure), Analyst (upload/run/view), Viewer (view only)
- [x] Organization-level isolation in application queries - org scoped with user fallback
- [x] Invite teammates by email
- [x] Enable Supabase RLS + add org-scoped policies to all three tables

### Week 7 - Audit Log UI + CSV Export - Complete
- [x] Audit trail logs file uploads, fee schedule uploads, and reconciliation runs
- [x] Every log entry captures timestamp, action, user/org, IP when available, run/discrepancy references, and metadata
- [x] Audit log exportable as CSV
- [x] Admin UI to view audit log with filtering by action, user, date range
- [x] CSV export for discrepancy tables

### Week 8 - Performance and Scale - Complete
- [x] BullMQ job queue - backend enqueue endpoint and worker implemented
- [x] Redis for job queue state (Upstash/Redis URL supported)
- [x] Reconcile endpoint streams progress events with SSE instead of blocking silently
- [x] Target: 50,000-row exact-match hot path under 90 seconds - benchmark: 423ms parse+match locally
- [x] Progress indicator showing current phase (parsing -> matching -> AI -> summary)
- [x] File size limit raised to 50MB; 100MB chunked upload deferred
- [x] Support additional input formats: TSV, JSON arrays, ODS, Google Sheets export files

### Week 9-10 - Onboarding and Instrumentation - Complete
- [x] First-run onboarding flow - dashboard checklist guides users through their first files
- [x] Usage tracking - runs, rows processed, AI-assisted matches, discrepancies found
- [x] Structured logging for AI calls
- [x] Health check endpoint with DB, queue, and AI configuration status
- [x] Rate limiting on upload and reconcile endpoints
- [x] Sentry integration for production error monitoring

---

## Phase 2 — Workflow Intelligence (Weeks 11–20)

**Goal:** Every discrepancy has an owner, a status, and a resolution. The tool becomes where the billing team does their work, not just something they run at month-end.

### Weeks 11–12 — Assign and Resolve
- [x] Discrepancy assignment — each discrepancy assignable to a team member with a note
- [x] Status workflow: `open` → `in_review` → `resolved` (resolution type: corrected / waived / duplicate / escalated)
- [x] Resolution comment required on close — logged to audit trail
- [x] Bulk actions — assign or resolve multiple discrepancies at once
- [x] My Queue view — each user sees only discrepancies assigned to them

### Weeks 13–14 — Notifications
- [x] Email alerts — run complete, discrepancy above $ threshold, item assigned to you, item overdue
- [x] Slack integration — post reconciliation summary to a channel, alert on critical discrepancies
- [x] Configurable thresholds per organization — "alert me when any single discrepancy exceeds $500"
- [x] Weekly digest email — outstanding discrepancies, resolution rate, revenue recovered

### Weeks 15–16 — Root Cause Taxonomy
- [x] Claude-powered root cause classification for every discrepancy:
  - `provisioning_gap` — product enrolled in CRM but not activated in billing engine
  - `rate_table_error` — MID provisioned with wrong processing rate
  - `plan_sync_failure` — upgrade/downgrade not propagated to billing system
  - `account_lifecycle_failure` — closure/deactivation not communicated to billing
  - `proration_logic_mismatch` — billing and account system use different pro-ration rules
  - `manual_override_not_propagated` — waiver or adjustment made in one system only
  - `data_sync_failure` — nightly sync between systems failed silently
  - `duplicate_record` — same charge entered twice
- [x] Root cause shown on each discrepancy card
- [x] Root cause trending — which internal processes generate the most errors month-over-month

### Weeks 17–18 — Trend Analytics
- [x] Month-over-month leakage tracking — total $ at risk, by type, by product line, by merchant
- [x] Trend dashboard — line charts of leakage over time, breakdown by discrepancy type
- [x] "Chronic offenders" view — merchants or product lines that appear in every billing cycle
- [x] Resolution rate tracking — what % of found discrepancies are actually fixed
- [x] Data export for all trend data as CSV or PDF

### Weeks 19–20 — Natural Language Q&A
- [x] Conversational interface — chat UI where users query reconciliation data in plain English:
  - "Which merchants have had rate mismatches in the last 3 months?"
  - "How much has FlowPay Processing leaked this year?"
  - "Show me all open discrepancies over $200 assigned to Sarah"
- [x] Claude translates natural language to structured Supabase queries, returns formatted results with supporting data
- [x] Auto-generated monthly insight report — leakage summary, top 5 issues, trend vs prior month, recommended actions by root cause
- [x] Shareable read-only dashboard link for management reporting

---

## Phase 3 — Automation (Weeks 21–30)

**Goal:** Recona catches errors before they age, not at month-end. The engine runs itself; the billing team manages exceptions.

### Weeks 21–23 — Scheduled Auto-Reconciliation
- [x] Configurable schedule — daily, weekly, or monthly; time zone aware
- [x] System pulls data from connected sources and runs automatically — no human trigger required
- [x] Alert fires immediately if discrepancies above threshold are found
- [x] Cadence selection by product line — run FlowPay processing daily, run platform fees weekly
- [x] "Catch it fast" mode — compare rolling 3-day window to catch provisioning errors before billing runs

### Weeks 24–26 — AI-Suggested Resolutions
- [x] For each high-confidence discrepancy, Claude proposes a concrete resolution action:
  - Missing invoice → "Draft invoice for $49.95 to Green Valley Market — Apex POS Pro — February 2024"
  - Rate mismatch → "Issue $37.49 credit to Tony's Pizzeria — FlowPay overbilled at 2.6% vs contracted 2.3%"
  - Missing contracted fee → "Provision LoyaltyLoop Starter for Sunrise Nail Studio (MID-3385719204) in billing engine"
  - Closed account billed → "Issue $14.95 credit to Coastal Boutique and deactivate MID"
- [x] One-click approve — user approves resolution, action is logged to audit trail
- [x] Draft invoice generation for missing invoices
- [x] Batch approval for similar issues (e.g. approve all 47 identical PCI fee mismatches at once)

### Weeks 27–28 — Revenue Recovered Scorecard
- [x] Dashboard metric: total underbilled revenue found and recovered since account creation
- [x] Secondary metric: total overbilling reversed
- [x] Historical attribution by product line, month, and discrepancy type

### Weeks 29–30 — Compliance Infrastructure
- [x] SOC 2 Type I process initiated via Vanta or Drata
- [x] Evidence collection automation — audit logs, access controls, encryption proofs
- [x] Data retention policy enforcement — configurable per org, automated deletion
- [x] GDPR/CCPA data handling
- [x] Penetration testing (external vendor)

---

## Phase 4 — Integration (Weeks 31–42)

**Goal:** No file uploads required. Recona connects directly to source systems.

### Weeks 31–34 — ERP Integrations
- [ ] **Salesforce** — OAuth 2.0; pull product charges, contract rates, and account status from Salesforce objects
- [ ] **NetSuite** — pull billing records and GL entries via NetSuite REST API
- [ ] **QuickBooks Online** — pull invoices and transactions
- [ ] **Generic SFTP connector** — Recona polls an SFTP server for file exports on a schedule
- [ ] Integration health dashboard — last sync time, row counts, error rate per integration

### Weeks 35–38 — Public API and Webhooks
- [ ] Public REST API — POST a reconciliation job, GET results, PATCH discrepancy status
- [ ] Webhook support — fire events on: run complete, discrepancy found above threshold, discrepancy resolved
- [ ] API keys with scoped permissions per organization
- [ ] Embeddable widget — iframe-embeddable reconciliation summary for billing portals
- [ ] Zapier / Make connector

### Weeks 39–42 — Enterprise Features
- [ ] **Multi-entity support** — one account manages multiple reconciliation workspaces
- [ ] **Consolidated reporting** — cross-entity leakage summary
- [ ] **Custom matching rules** — org-specific logic configured without code (e.g. "match on account_number not merchant_id for DNA clients")
- [ ] **SLA tracking** — discrepancies older than N business days auto-escalate to manager
- [ ] **Custom discrepancy taxonomy** — organizations define their own root cause categories

---

## Phase 5 — Platform (Weeks 43–60)

**Goal:** Recona becomes infrastructure for revenue integrity across financial services. White-label capability opens a new distribution channel.

### Partner / ISV Revenue Share Reconciliation
- [ ] Verify that revenue share payments from payment networks match what partners are owed
- [ ] ISV fee split verification — for processors that split fees with software partners
- [ ] Interchange reconciliation — verify interchange fees collected match interchange paid to networks

### White-Label / OEM
- [ ] Full white-label capability — embed Recona into an existing operations portal under custom branding
- [ ] Custom domain, custom branding, custom email templates
- [ ] Shared data model or fully isolated deployment options

### SOC 2 Type II + Enterprise Security
- [ ] SOC 2 Type II certification (12-month observation period)
- [ ] SSO/SAML for enterprise customers (Okta, Azure AD, Google Workspace)
- [ ] IP allowlisting and VPN-only access options
- [ ] Dedicated tenant deployment for highest-security customers
- [ ] Annual penetration testing, quarterly access reviews

---

## Key Engineering Principles

1. **The amount is what's in dispute** — never use the billed amount as a match key. Match on merchant ID + product line + fee type + billing period. Amount differences are discrepancies, not non-matches.

2. **Batch all AI calls** — never call Claude row-by-row. Batch fuzzy match candidates (up to 25 pairs per call), batch root cause classification, batch resolution suggestions. Control cost and latency.

3. **Every AI decision is auditable** — log Claude's exact input, output, model version, confidence score, and timestamp for every call that affects a discrepancy classification. No black boxes in financial data.

4. **Graceful degradation without fee schedule** — the 2-file reconciliation catches ~60% of discrepancies. The fee schedule catches the rest. The engine must be useful without it and dramatically better with it.

5. **Financial data requires paranoia** — encrypt at rest (DB encryption), TLS in transit, no PII in logs, 90-day file retention with auto-deletion, full audit trail from day one.

6. **Test against real mess** — test data must include: different date formats, name variations, rounding differences, missing rows, duplicate rows, mid-cycle events, closed accounts still billed. If the engine handles those, it handles production.

7. **File format is irrelevant to the engine** — the reconciliation engine only sees normalized records. Any input format (CSV, Excel, JSON, TSV, ODS, API response) is valid as long as it can be parsed into rows with a column mapping step. Claude handles the mapping regardless of the source format.

---

## Architecture Milestones

| When | What changes |
|---|---|
| Phase 0 complete | In-memory file store, synchronous processing, no auth |
| Phase 1 complete | Postgres persistence, BullMQ queues, Clerk auth, CSV export, multi-format input |
| Phase 2 complete | Full workflow (assign/resolve), notifications, trend analytics, NL Q&A |
| Phase 3 complete | Scheduled auto-recon, AI resolutions, SOC 2 Type I |
| Phase 4 complete | ERP integrations, public API, multi-entity |
| Phase 5 complete | White-label OEM, SOC 2 Type II, full platform |
