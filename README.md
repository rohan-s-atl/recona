# Recona

**Revenue integrity infrastructure for billing reconciliation.**

Recona compares what was contracted, what was charged, and what was billed. It turns billing data from product systems, invoice systems, and fee schedules into a structured reconciliation workflow for finding underbilling, overbilling, rate mismatches, missing fees, duplicate invoices, closed-account billing, and other revenue-control issues.

Recona is designed for finance, billing, product operations, and middle-office teams that need a clearer way to reconcile operational data without living in spreadsheets. It combines deterministic matching, AI-assisted mapping, workflow tracking, audit history, and recovery reporting into one system.

## Why Recona

Billing reconciliation is often scattered across exports, spreadsheet formulas, manual lookups, and one-off reviews. That makes it difficult to see where revenue is leaking, which discrepancies are still open, who owns each exception, and how much value has actually been recovered.

Recona gives teams a shared operating layer for that work:

- It standardizes product charges, billing invoices, and fee schedules into one reconciliation format.
- It matches records by business identity instead of relying on invoice amounts as proof of correctness.
- It uses AI where messy real-world data needs interpretation, such as column mapping, merchant-name variation, summaries, and suggested resolution actions.
- It preserves every run, discrepancy, owner, status change, AI call, export, and recovery decision as audit history.
- It turns reconciliation results into queues, approvals, analytics, scorecards, scheduled runs, and management-ready reports.

The goal is to make revenue integrity continuous, reviewable, and operational instead of episodic and spreadsheet-bound.

## Product Description

Recona supports the full reconciliation lifecycle from upload through resolution:

- Upload product charges, billing invoices, and optional fee schedules.
- Auto-map columns with AI and normalize CSV, TSV, Excel, ODS, and JSON inputs.
- Run exact matching across merchant, product, fee type, and billing period.
- Apply AI fuzzy matching when systems disagree on names or formatting.
- Compare billed fees against contracted rates, plans, and expected fee schedules.
- Classify discrepancies by type, direction, severity, root cause, owner, and workflow state.
- Assign exceptions with due dates, notes, review states, and escalation context.
- Generate AI-suggested resolution actions for billing and recovery teams.
- Approve recoveries into a revenue scorecard.
- Export reports and share read-only management links.
- Schedule recurring reconciliation from saved source snapshots.
- Ask natural-language questions over reconciliation and workflow data.

## Product Surface

| Area | Purpose |
|---|---|
| Dashboard | Run history, exposure, next actions, queue counts, and recovery impact |
| Upload Flow | File upload, column mapping, reconciliation progress, results, and exception workflow |
| Runs | Persistent run ledger with detailed reports and downloadable PDFs |
| Queue | Assigned discrepancy work queue with ownership, due dates, and overdue indicators |
| Resolutions | Approval desk for AI-suggested recovery actions |
| Scorecard | Recovered underbilling, reversed overbilling, and escalation tracking |
| Analytics | Root causes, chronic offenders, trends, product exposure, and exportable analysis |
| Automation | Scheduled reconciliation using reusable source snapshots |
| Ask | Natural-language questions over reconciliation and operational data |
| Audit | Event history for uploads, runs, workflow updates, AI calls, exports, and access |
| Settings | Notifications, invitations, roles, and organization controls |
| Compliance | Retention controls and evidence collection |

## Technical Breakdown

### Architecture

```text
recona/
|-- frontend/    Next.js app, API routes, reconciliation engine, UI
|-- backend/     Express queue API and BullMQ worker
|-- ai/          AI-related source area
|-- docs/        Schema, migrations, roadmap, demo data
|-- scripts/     Smoke tests, env checks, load-test generators
```

### Runtime Flow

```text
Browser
  |-- /api/upload
  |     Parse file, infer mapping, store source snapshot
  |
  |-- /api/reconcile
  |     Interactive SSE reconciliation for smaller/manual runs
  |
  |-- /api/reconcile/queued
  |     Enqueue large/background jobs through Railway backend + Redis
  |
  |-- /api/schedules/dispatch
  |     Daily scheduled reconciliation dispatch
  |
  |-- /api/notifications/dispatch
        Daily notification dispatch

Worker
  |-- BullMQ job -> /api/reconcile/internal -> shared reconciliation engine
```

### Reconciliation Pipeline

1. **Parse** - Load charges, invoices, and optional fee schedules.
2. **Normalize** - Convert source columns into canonical reconciliation records.
3. **Exact match** - Join records by merchant, billing period, product line, and fee type.
4. **Fuzzy match** - Batch unresolved candidates through Claude for likely real-world matches.
5. **Rate check** - Compare billed amounts against contracted rates and plans.
6. **Missing fee detection** - Identify contracted products and fees absent from billing.
7. **Classification** - Attach discrepancy type, severity, direction, root cause, and workflow state.
8. **Persistence** - Save run data, discrepancy records, audit events, and source snapshots.
9. **Resolution loop** - Assign, approve, resolve, and track recovered impact.

### Core Modules

| Module | Responsibility |
|---|---|
| `fileParser.ts` | CSV, TSV, Excel, ODS, and JSON parsing |
| `normalizer.ts` | Canonical record normalization |
| `matcher.ts` | Exact matching and discrepancy construction |
| `rateChecker.ts` | Contracted rate and plan validation |
| `claude.ts` | AI column mapping, fuzzy matching, summaries, and suggestions |
| `reconcileEngine.ts` | End-to-end reconciliation orchestration |
| `db.ts` | Supabase persistence, workflow, analytics, and recovery ledger |
| `pdfReport.ts` | Run report generation |
| `security.ts` | Constant-time checks for protected cron and worker routes |
| `rateLimit.ts` | Route rate limiting with bucket pruning |

### Discrepancy Model

| Type | Meaning |
|---|---|
| `missing_from_billing` | Charge exists but invoice was never issued |
| `missing_from_charges` | Invoice exists with no matching product charge |
| `rate_mismatch` | Billed rate differs from contract |
| `plan_mismatch` | Billed product tier differs from contract |
| `amount_mismatch` | Matched item has an unexpected amount difference |
| `missing_contracted_fee` | Fee schedule includes a fee missing from billing |
| `closed_account_billed` | Closed or inactive account is still billed |
| `proration_error` | Mid-cycle billing differs from expected proration |
| `duplicate_invoice` | Same fee appears to be invoiced more than once |
| `name_variation_flagged` | AI matched a name variation for review |

### Stack

| Layer | Technology |
|---|---|
| Frontend | Next.js 14 App Router, React 18, TypeScript, Tailwind CSS |
| Backend | Node.js, Express, TypeScript |
| Queue | BullMQ, Redis |
| Database | Supabase PostgreSQL with RLS |
| Auth | Clerk roles and organization/user scoping |
| AI | Anthropic Claude |
| Monitoring | Sentry |
| Deployment | Vercel frontend/API routes, Railway backend/worker |
| CI | GitHub Actions lint/typecheck and smoke workflow |

### Data And Control Layer

Recona stores reconciliation runs, source snapshots, discrepancies, workflow updates, approvals, exports, and audit events in Supabase. Clerk scopes access by user and organization. Protected internal routes use shared-secret checks for cron and worker traffic. Queue-backed reconciliation uses Railway, BullMQ, and Redis for background processing while the Next.js API routes provide upload, reporting, analytics, workflow, scheduling, sharing, and AI-assisted interaction endpoints.

## Links

- Live app: https://recona-ai.vercel.app/
- Repository: https://github.com/rohan-s-atl/recona
- Roadmap: [docs/ROADMAP.md](docs/ROADMAP.md)
- Schema: [docs/schema.sql](docs/schema.sql)
- Demo data: [docs/test-data](docs/test-data)
