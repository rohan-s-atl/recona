# Recona

**Revenue integrity infrastructure for billing reconciliation.**

Recona compares what was contracted, what was charged, and what was billed. It finds revenue leakage, overbilling, rate mismatches, missing fees, duplicate invoices, closed-account billing, and other billing-control failures, then turns those findings into an auditable workflow.

**Live app:** https://recona-ai.vercel.app/

---

## What It Does

Recona is built for finance, billing, product operations, and middle-office teams that need to reconcile messy operational data without spending days in spreadsheets.

- Upload product charges, billing invoices, and an optional fee schedule
- Auto-map columns with AI
- Normalize CSV, TSV, Excel, ODS, and JSON inputs into one reconciliation format
- Match records by merchant, product, fee type, and billing period
- Use AI fuzzy matching when source systems disagree on names or formatting
- Detect contract/rate mismatches when a fee schedule is present
- Persist every run with full audit history
- Assign discrepancies to owners with due dates and notes
- Track open, in-review, and resolved exceptions
- Generate AI-suggested resolution actions
- Approve recoveries into a revenue scorecard
- Export reports and share read-only management links
- Run scheduled reconciliation from saved source snapshots

---

## Product Surface

| Area | What it provides |
|---|---|
| Dashboard | Command center with run history, exposure, next actions, queue counts, and recovery impact |
| Upload Flow | Guided file upload, column mapping, progress, results, and exception workflow |
| Runs | Persistent run ledger and detailed run reports |
| Queue | Assigned discrepancy work queue with overdue indicators |
| Resolutions | Approval desk for AI-suggested recovery actions |
| Scorecard | Underbilled revenue recovered, overbilling reversed, and escalation tracking |
| Analytics | Root causes, chronic offenders, trends, and product exposure |
| Automation | Scheduled reconciliation from reusable source snapshots |
| Ask | Natural-language questions over reconciliation/workflow data |
| Audit | Audit trail for uploads, runs, workflow updates, AI calls, and exports |
| Settings | Notification settings, invite flow, roles, and organization controls |
| Compliance | Retention controls and evidence collection |

---

## Reconciliation Engine

### Pipeline

1. **Parse** - Load charges, invoices, and optional fee schedule.
2. **Normalize** - Convert source columns into canonical records.
3. **Exact match** - Hash-join by merchant, billing period, product line, and fee type.
4. **Fuzzy match** - Batch unresolved candidates through Claude for likely real-world matches.
5. **Rate check** - Compare billed amounts against contracted rates and plans.
6. **Missing fee detection** - Find contracted products that never appeared in billing.
7. **Classification** - Attach severity, direction, root cause, and workflow state.
8. **Persistence** - Save run, discrepancies, audit records, and source snapshots.
9. **Resolution loop** - Assign, approve, resolve, and track recovered impact.

### Discrepancy Types

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
| `name_variation_flagged` | AI matched a name variation requiring review |

---

## Architecture

```text
recona/
├── frontend/    Next.js app, API routes, reconciliation engine, UI
├── backend/     Express queue API and BullMQ worker
├── docs/        Schema, migrations, launch checklist, demo data
└── scripts/     Smoke tests, env checks, load-test generators
```

### Runtime Flow

```text
Browser
  ├─ /api/upload
  │    Parse file, infer mapping, store source snapshot
  │
  ├─ /api/reconcile
  │    Interactive SSE reconciliation for smaller/manual runs
  │
  ├─ /api/reconcile/queued
  │    Enqueue large/background jobs through Railway backend + Redis
  │
  ├─ /api/schedules/dispatch
  │    Daily cron-driven scheduled reconciliation
  │
  └─ /api/notifications/dispatch
       Daily cron-driven notification dispatch

Worker
  └─ BullMQ job -> /api/reconcile/internal -> same reconciliation engine
```

### Core Modules

| Module | Responsibility |
|---|---|
| `fileParser.ts` | CSV, TSV, Excel, ODS, JSON parsing |
| `normalizer.ts` | Canonical record normalization |
| `matcher.ts` | Exact matching and discrepancy construction |
| `rateChecker.ts` | Contracted rate/plan validation |
| `claude.ts` | AI column mapping, fuzzy matching, summaries |
| `reconcileEngine.ts` | End-to-end orchestration |
| `db.ts` | Supabase persistence, workflow, analytics, recovery ledger |
| `security.ts` | Constant-time secret checks for cron/worker routes |
| `rateLimit.ts` | In-memory route rate limiting with bucket pruning |

---

## Stack

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
| CI | GitHub Actions lint/typecheck and optional production smoke workflow |

---

## Deployment Status

The project is wired for low-cost deployment:

- Frontend/API routes: Vercel
- Backend queue API: Railway
- Worker: Railway
- Database: Supabase
- Queue: Redis
- Auth: Clerk development instance until a custom domain is attached
- Daily cron: Vercel Hobby-compatible once-daily schedules

Production hardening already included:

- Security headers
- Constant-time secret comparison
- Worker and cron endpoint auth
- Upload file type/size validation
- Share-link TTL bounds
- Rate-limit bucket pruning
- Backend CORS origin allowlist
- Backend JSON body-size limit
- Health endpoints
- Smoke-test tooling
- DB index hardening migration

---

## Local Setup

### Install

```powershell
npm install
```

### Environment

```powershell
Copy-Item .env.example .env
Copy-Item frontend\.env.example frontend\.env.local
```

Required frontend values:

```env
ANTHROPIC_API_KEY=

NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=
CLERK_SECRET_KEY=

NEXT_PUBLIC_APP_URL=http://localhost:3000
BACKEND_URL=http://localhost:4000
NEXT_PUBLIC_BACKEND_URL=http://localhost:4000
INTERNAL_WORKER_SECRET=change-me
CRON_SECRET=change-me-too
SHARE_LINK_SECRET=change-me-to-a-long-random-secret
REDIS_URL=redis://localhost:6379
```

Required backend values:

```env
NEXT_PUBLIC_APP_URL=http://localhost:3000
INTERNAL_WORKER_SECRET=change-me
CORS_ORIGINS=http://localhost:3000
REDIS_URL=redis://localhost:6379
RECONCILE_JOB_TIMEOUT_MS=180000
```

Validate the environment template:

```powershell
npm run check:env -- --mode=example
```

---

## Database

For a fresh Supabase project, run:

```text
docs/schema.sql
docs/migrations/2026-05-14-launch-hardening-indexes.sql
```

For an existing project, run the migrations in order:

```text
docs/migrations/2026-05-13-auth-org-scope.sql
docs/migrations/2026-05-14-phase-2-workflow.sql
docs/migrations/2026-05-14-phase-3-automation.sql
docs/migrations/2026-05-14-launch-hardening-indexes.sql
```

Optional demo seed:

```text
docs/demo-workspace.sql
```

---

## Running Locally

Start Redis if running locally:

```powershell
docker run -p 6379:6379 redis:7
```

Start services in separate terminals:

```powershell
npm run dev --workspace=frontend
npm run dev --workspace=backend
npm run dev:worker --workspace=backend
```

Frontend:

```text
http://localhost:3000
```

Backend:

```text
http://localhost:4000
```

---

## Verification

Full repo check:

```powershell
npm run check
```

Health checks:

```powershell
Invoke-RestMethod http://localhost:3000/api/health
Invoke-RestMethod http://localhost:4000/health
```

Smoke test deployed app:

```powershell
$env:RECONA_FRONTEND_URL="https://recona-ai.vercel.app"
$env:RECONA_BACKEND_URL="https://your-railway-backend"
$env:INTERNAL_WORKER_SECRET="your-secret"
npm run smoke
```

Load-test utilities:

```powershell
npm run loadtest:generate
npm run loadtest:match
```

---

## Production Notes

Before calling it production:

- Add the custom domain to Vercel
- Create the Clerk production instance using that custom domain
- Replace Clerk test keys with live keys in Vercel
- Add `CRON_SECRET` to Vercel
- Add `CORS_ORIGINS=https://recona-ai.vercel.app` or your custom domain to Railway
- Run the launch hardening index migration in Supabase
- Configure GitHub smoke workflow secrets if desired:
  - `RECONA_FRONTEND_URL`
  - `RECONA_BACKEND_URL`
  - `INTERNAL_WORKER_SECRET`

See `docs/LAUNCH_CHECKLIST.md` for the launch checklist.

---

## Engineering Principles

**The amount is never a match key.** Match on merchant, product, fee type, and billing period. Amount differences are discrepancies.

**Batch all AI calls.** Claude is never called row-by-row. Fuzzy matching, summaries, classification, and suggestions are batched.

**Every AI decision is auditable.** AI inputs, outputs, model metadata, confidence, and status are logged.

**Graceful degradation matters.** Two-file reconciliation works without a fee schedule; contract-aware reconciliation gets stronger with one.

**Financial data requires paranoia.** Access control, RLS, audit trails, retention, validation, rate limiting, and scoped secrets are built in.

**File format is not the engine.** All source formats become normalized records before matching.
