# Recona - Engineering Roadmap

**Last updated:** May 14, 2026

## Current Status

Recona has moved beyond the file-upload MVP into a deployed, workflow-capable reconciliation product.

- **Phase 0 - Foundation:** Complete
- **Phase 1 - Production MVP:** Complete
- **Phase 2 - Workflow Intelligence:** Complete
- **Phase 3 - Automation:** Product implementation complete; external compliance certification still pending
- **Launch hardening:** Vercel/Railway deployment, health checks, UX pass, motion pass, and cleanup pass complete
- **Next major build:** Phase 4 integrations and public API

### Recently Completed Hardening

- Vercel frontend deployment and Railway backend/worker deployment validated
- Supabase schema/migrations brought current through Phase 3
- Production health checks for database, queue, Redis, Sentry, and AI configuration
- Upload persistence hardened for serverless hosting via Supabase source snapshots
- Queue and Resolutions UX clarified with counters, guided empty states, and approval workflow
- Full-app UX pass across dashboard, upload, run detail, queue, resolutions, automation, scorecard, and settings
- Full-app motion pass: frosted route loader, page transitions, calm panel/table/button animations, reduced-motion fallback
- Dead-code/performance cleanup: removed unused backend upload route and `multer`, replaced hard reloads, optimized nav badge counts

---

## What We're Building

Payment processors and fintech platforms operate dozens of product lines billed to thousands or millions of merchants every month. The billing engine, the account management system, and the contract database are often separate systems maintained by separate teams. Data gets out of sync constantly because the systems were never designed to stay aligned across the full product lifecycle.

The result is silent revenue leakage. Merchants contracted for one plan get billed at another. Processing rates are provisioned incorrectly at onboarding and never caught. Add-on products are enrolled in CRM but never activated in the billing engine. Closed accounts are billed for months after deactivation.

Recona is the reconciliation layer between what is contracted, what is charged, and what is billed. It runs checks, surfaces discrepancies, assigns work, recommends fixes, and tracks recovered revenue.

---

## Phase 0 - Foundation - Complete

### What Was Built

- Monorepo: `/frontend`, `/backend`, `/docs`
- 3-file upload flow: product charges, billing invoices, optional fee schedule
- AI column mapping, exact matching, fuzzy matching, rate and plan mismatch detection
- 9 discrepancy types:
  - `missing_from_billing`
  - `missing_from_charges`
  - `rate_mismatch`
  - `plan_mismatch`
  - `amount_mismatch`
  - `missing_contracted_fee`
  - `closed_account_billed`
  - `proration_error`
  - `duplicate_invoice`
- Results by merchant, issue, and product line
- AI executive summary after every run

### Fictional Product Suite

| Product | Description | Analog |
|---|---|---|
| Apex POS | Merchant point-of-sale platform | Clover POS |
| FlowPay Processing | Merchant payment processing | Clover Payments |
| ShieldNet | PCI compliance and fraud protection | Clover Security |
| LoyaltyLoop | Customer loyalty platform | Clover Rewards |
| InsightIQ | Merchant analytics and reporting | Main Street Insights |
| WebCharge Terminal | Web virtual terminal | Clover Virtual Terminal |
| Nexus Commerce | Enterprise payments orchestration | Carat |
| ClearCore Banking Suite | Banking core infrastructure | DNA |

---

## Phase 1 - Production MVP - Complete

**Goal:** Every reconciliation run is persisted, auditable, exportable, and gated behind auth. The engine handles large files without blocking the UI.

### Core Reconciliation

- [x] File upload engine for CSV, TSV, Excel, ODS, and JSON
- [x] AI column mapping and normalization
- [x] Merchant/product/fee-aware exact matching
- [x] Fuzzy matching with AI support
- [x] Rate and plan mismatch detection
- [x] Missing contracted fee detection
- [x] Multi-tab result views

### Persistence and Reporting

- [x] Supabase schema for runs, discrepancies, and audit log
- [x] Reconcile API persists every run and discrepancy
- [x] Run history page
- [x] Run detail page with persistent URL
- [x] PDF export via print CSS
- [x] CSV export for discrepancy data

### Auth, Roles, and Audit

- [x] Clerk authentication
- [x] Role-based access: admin, analyst, viewer
- [x] Organization-level data isolation with user fallback
- [x] Invite teammates by email
- [x] Audit trail for uploads, runs, workflow actions, and AI calls
- [x] Admin audit log UI with CSV export

### Scale and Instrumentation

- [x] BullMQ queue and Redis-backed worker
- [x] SSE progress updates for interactive runs
- [x] Background queued reconciliation for larger jobs
- [x] 50,000-row exact-match benchmark under target
- [x] Health check endpoint
- [x] Rate limiting on upload and reconciliation endpoints
- [x] Sentry integration

---

## Phase 2 - Workflow Intelligence - Complete

**Goal:** Every discrepancy has an owner, a status, and a resolution. The tool becomes where the billing team works exceptions, not just something they run at month-end.

### Assignment and Resolution

- [x] Discrepancy assignment with owner, note, and due date
- [x] Status workflow: `open` -> `in_review` -> `resolved`
- [x] Resolution types: corrected, waived, duplicate, escalated
- [x] Resolution comment captured on close
- [x] Bulk assign, review, and resolve actions
- [x] My Queue view for assigned discrepancies
- [x] Red nav counters for assigned queue and pending resolutions

### Notifications

- [x] Notification settings per organization
- [x] Alert threshold configuration
- [x] Notification outbox
- [x] Email notification path
- [x] Slack notification path
- [x] Run complete, high-risk discrepancy, assignment, overdue, and digest events

### Root Cause and Analytics

- [x] Root cause classification categories
- [x] Root cause shown on discrepancy records
- [x] Month-over-month leakage tracking
- [x] Trend dashboard
- [x] Chronic offenders view
- [x] Resolution rate tracking
- [x] Analytics CSV export

### Natural Language Q&A and Sharing

- [x] Ask page for plain-English reconciliation questions
- [x] Structured answers over workflow/discrepancy data
- [x] AI audit logging for Q&A
- [x] Shareable read-only management links

---

## Phase 3 - Automation - Product Complete

**Goal:** Recona catches errors before they age. The engine runs itself; the billing team manages exceptions.

### Scheduled Auto-Reconciliation

- [x] Daily, weekly, or monthly schedules
- [x] Time-zone-aware next run calculation
- [x] Saved source snapshots for scheduled runs
- [x] Optional fee schedule snapshot for automated rate checks
- [x] Worker dispatch endpoint
- [x] Schedule locking/claim behavior to prevent duplicate runs
- [x] Catch-it-fast rolling window configuration
- [x] Automation UI explaining upload -> snapshot -> schedule setup

### AI-Suggested Resolutions

- [x] Resolution suggestions for high-confidence discrepancies
- [x] Suggested actions for missing invoices, credits, provisioning, deactivation, and rate correction
- [x] Approval desk at `/resolutions`
- [x] Batch approval for pending suggestions
- [x] Backfill action for older runs
- [x] Approval writes recovery ledger and resolves linked discrepancy

### Revenue Recovery Scorecard

- [x] Total underbilled revenue recovered
- [x] Total overbilling reversed
- [x] Escalated impact tracking
- [x] Attribution by product line and discrepancy type
- [x] Empty states route users back to approvals

### Compliance Controls

- [x] Compliance controls UI
- [x] Evidence collection automation
- [x] Configurable retention policy
- [x] Automated retention enforcement endpoint
- [x] GDPR/CCPA-oriented retention controls
- [ ] SOC 2 Type I process initiated via Vanta or Drata
- [ ] External penetration test
- [ ] Formal privacy policy, DPA, subprocessors list, and incident response policy

---

## Launch Track - Production Readiness

**Goal:** Convert the deployed app into a clean customer-facing production launch.

### Domain, Auth, and Environments

- [ ] Purchase or confirm primary domain
- [ ] Recommended domain structure:
  - Marketing site: `recona.ai`
  - App: `app.recona.ai`
  - API later: `api.recona.ai`
- [ ] Add custom app domain to Vercel
- [ ] Create Clerk production instance using the custom app domain
- [ ] Replace production Clerk env vars with `pk_live_...` and `sk_live_...`
- [ ] Configure production OAuth credentials for Google/GitHub SSO if enabled
- [ ] Keep local `.env.local` on Clerk development keys

### Deployment Operations

- [x] Vercel frontend configured
- [x] Railway backend API configured
- [x] Railway worker configured
- [x] Redis queue configured
- [x] Supabase schema current through Phase 3
- [x] Frontend `/api/health` returns OK
- [x] Backend `/health` returns OK
- [x] Add Vercel cron config for daily `/api/schedules/dispatch`
- [x] Add Vercel cron config for daily `/api/notifications/dispatch`
- [x] Add `CRON_SECRET` bearer auth support for cron endpoints
- [x] Add GitHub Actions CI for frontend lint, frontend typecheck, backend typecheck, and env-template validation
- [x] Add smoke test script for frontend/backend health and dispatcher auth checks
- [x] Add scheduled GitHub smoke workflow for production health checks when URL secrets are configured
- [x] Add DB index hardening migration for workflow, scheduler, analytics, and notification queries
- [x] Add zero-cost GitHub notification path for failed scheduled smoke checks
- [ ] Add paid/managed alerting only if the project becomes customer-facing

### Product Polish

- [x] Whole-app UX pass
- [x] Resolution workflow guidance and counters
- [x] Whole-app motion pass
- [x] Dead-code and performance cleanup
- [x] Launch checklist documentation
- [x] Demo workspace seed SQL
- [ ] Cross-browser smoke test
- [ ] Mobile/tablet layout smoke test
- [ ] Run seeded demo workspace in production Supabase after final auth/domain choice

---

## Phase 4 - Integration

**Goal:** No file uploads required. Recona connects directly to source systems.

### ERP and Source Integrations

- [ ] Salesforce OAuth connector for product charges, contracts, and account status
- [ ] NetSuite connector for billing records and GL entries
- [ ] QuickBooks Online connector for invoices and transactions
- [ ] Generic SFTP connector for scheduled file exports
- [ ] Integration health dashboard with last sync time, row counts, and error rate

### Public API and Webhooks

- [ ] Public REST API for reconciliation jobs, results, and discrepancy workflow updates
- [ ] Webhook events: run complete, high-risk discrepancy, discrepancy resolved
- [ ] API keys with scoped permissions per organization
- [ ] Embeddable reconciliation summary widget
- [ ] Zapier/Make connector

### Enterprise Workflow

- [ ] Multi-entity workspaces
- [ ] Consolidated reporting across entities
- [ ] Custom matching rules configured without code
- [ ] SLA tracking and auto-escalation
- [ ] Custom discrepancy/root-cause taxonomy

---

## Phase 5 - Platform

**Goal:** Recona becomes infrastructure for revenue integrity across financial services.

### Partner / ISV Revenue Share Reconciliation

- [ ] Verify revenue share payments from payment networks
- [ ] ISV fee split verification
- [ ] Interchange reconciliation

### White Label / OEM

- [ ] White-label app branding
- [ ] Custom domains and custom email templates
- [ ] Shared data model or isolated deployment options

### Enterprise Security

- [ ] SOC 2 Type II certification
- [ ] SSO/SAML for Okta, Azure AD, and Google Workspace
- [ ] IP allowlisting
- [ ] Dedicated tenant deployment option
- [ ] Annual penetration testing and quarterly access reviews

---

## Key Engineering Principles

1. **The amount is what's in dispute.** Never use billed amount as a match key. Amount differences are discrepancies, not non-matches.

2. **Batch all AI calls.** Never call Claude row-by-row. Batch fuzzy match candidates, classifications, summaries, and resolution suggestions.

3. **Every AI decision is auditable.** Log input, output, model version, confidence, and timestamp for every AI-assisted decision that affects financial workflow.

4. **Graceful degradation without fee schedule.** The two-file reconciliation must be useful without contracts and much stronger with them.

5. **Financial data requires paranoia.** Use TLS, strict access control, no PII in logs, scoped retention, and full audit trail.

6. **Test against real mess.** Date formats, name variations, rounding differences, missing rows, duplicates, mid-cycle events, and closed accounts must all be represented.

7. **File format is irrelevant to the engine.** The engine sees normalized records. CSV, Excel, JSON, TSV, ODS, API response, and future integrations all feed the same core flow.

---

## Architecture Milestones

| Milestone | What changes |
|---|---|
| Phase 0 complete | In-memory processing, synchronous runs, no auth |
| Phase 1 complete | Postgres persistence, BullMQ queues, Clerk auth, CSV/PDF export, multi-format input |
| Phase 2 complete | Assignment workflow, notifications, analytics, NL Q&A |
| Phase 3 product complete | Scheduled auto-recon, AI resolutions, recovery scorecard, compliance controls |
| Launch ready | Custom domain, Clerk production instance, production cron, smoke tests |
| Phase 4 complete | ERP integrations, public API, multi-entity |
| Phase 5 complete | White-label/OEM, SOC 2 Type II, enterprise platform |
