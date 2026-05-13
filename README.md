# Recona

**Revenue integrity infrastructure for financial services.**

Every month, inside banks, fintechs, and payment processors, two teams produce two files that are supposed to agree with each other. They almost never do. Charges get recorded but never billed. Fees get applied at the wrong rate. A system sync fails at 2am and nobody notices until six weeks later. Across thousands of clients, dozens of products, and twelve billing cycles a year, the losses compound quietly. Industry research puts revenue leakage from billing mismatches at 1–5% of total annual revenue — up to $5M annually for a firm doing $100M.

Recona is the reconciliation layer between what is contracted, what is charged, and what is billed. It takes the file the product team produces and the file the billing team produces, compares them automatically, surfaces every discrepancy, and tells you exactly what to fix. The entire process that used to take a person two days takes the system under five minutes.

---

## What makes it different

Most comparison tools fail the moment the data gets messy — which is always. Recona uses large language models at its core to understand what the data *means*, not just what it says.

- It recognizes that `"JPMorgan"` and `"JP Morgan Chase LLC"` are the same client
- It flags that a $9,999.99 charge and a $10,000.00 invoice are almost certainly the same event
- It classifies *why* a mismatch happened — timing gap, missing client setup, unapproved fee schedule — so teams know exactly what to fix and who should fix it
- It generates an executive summary after every run: total exposure, top issues by severity, recommended actions

The output isn't a list of problems. It's a complete picture of financial exposure.

---

## Architecture

```
recona/
├── frontend/    Next.js 14 app — UI, API routes, reconciliation engine
├── backend/     Express — Redis queue, BullMQ worker
├── ai/          Shared Anthropic SDK wrapper
├── docs/        Schema, migrations, roadmap, test data
└── scripts/     Load-test generators and benchmarks
```

### Request flow

```
Browser
  │
  ├─ /api/upload          → Parse file, AI column mapping (Claude Haiku)
  │
  ├─ /api/reconcile       → SSE stream: parse → exact match → fuzzy match
  │    (small files)         (Claude Sonnet) → rate check → summary → persist
  │
  └─ /api/reconcile/queued → Enqueue to Redis → BullMQ Worker
       (large files)          → /api/reconcile/internal → same engine
                              → Poll /api/runs/[jobId]/status

Engine (frontend/src/lib/)
  ├─ fileParser.ts        Multi-format parsing (CSV, TSV, XLSX, ODS, JSON)
  ├─ normalizer.ts        Record normalization
  ├─ matcher.ts           O(n) hash join for exact matches; AI batch fuzzy
  ├─ rateChecker.ts       Contracted rate vs billed amount validation
  ├─ claude.ts            Anthropic API calls (column mapping, fuzzy, summary)
  └─ reconcileEngine.ts   Orchestration + discrepancy classification

Persistence
  ├─ Supabase PostgreSQL  reconciliation_runs, discrepancies, audit_log
  ├─ Clerk JWT            Auth + org/user scoping
  └─ RLS policies         Row-level security on all three tables
```

---

## Reconciliation engine

### Matching pipeline

1. **Parse** — Load charge and invoice files; normalize all records into a canonical shape regardless of input format or column names
2. **Exact match** — O(n) hash join on `merchant_id + billing_period + product_line + fee_type`; 2% amount tolerance accepted
3. **Fuzzy match** — Unmatched pairs are batched (up to 25 per call) and sent to Claude Sonnet, which decides whether they represent the same underlying event
4. **Rate check** — For every match, compare billed amount against the contracted rate in the fee schedule
5. **Missing fee detection** — Identify contracted fees that appear nowhere in billing
6. **Executive summary** — Claude Sonnet produces a plain-English narrative with total exposure, top issues, and recommended actions

### Discrepancy types

| Type | Description |
|---|---|
| `missing_from_billing` | Charge recorded; invoice never issued |
| `missing_from_charges` | Invoice issued; no charge in product system |
| `rate_mismatch` | Processing rate billed differs from contract |
| `plan_mismatch` | Product tier billed (Core vs Pro) differs from contract |
| `amount_mismatch` | Dollar amount differs outside tolerance |
| `missing_contracted_fee` | Fee in fee schedule not present in billing |
| `closed_account_billed` | Account deactivated; billing continued |
| `proration_error` | Mid-cycle onboarding billed for full period |
| `duplicate_invoice` | Same charge invoiced more than once |

### Severity thresholds

| Amount | Severity |
|---|---|
| ≥ $500 | critical |
| ≥ $100 | high |
| ≥ $25 | medium |
| < $25 | low |

---

## Stack

| Layer | Technology |
|---|---|
| Frontend | Next.js 14 (App Router), React 18, TypeScript, Tailwind CSS |
| Backend | Node.js, Express, TypeScript |
| Queue | BullMQ v5, Redis (Upstash or self-hosted) |
| Database | Supabase — PostgreSQL with row-level security |
| Auth | Clerk — JWT, org management, SSO |
| AI | Anthropic Claude — Haiku (column mapping), Sonnet (fuzzy match + summary) |
| Parsing | Papa Parse (CSV/TSV), SheetJS (XLSX/ODS), native JSON |
| Monitoring | Sentry — error tracking, source maps, performance |

---

## Local setup

### Prerequisites

- Node.js 18+
- Docker (for Redis) or an Upstash Redis URL
- Supabase project
- Clerk app
- Anthropic API key

### Install

```powershell
npm install
```

### Environment

```powershell
Copy-Item .env.example .env
Copy-Item frontend\.env.example frontend\.env.local
```

Fill in the required values:

**`frontend/.env.local`**

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=
CLERK_SECRET_KEY=
NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in
NEXT_PUBLIC_CLERK_SIGN_UP_URL=/sign-up
NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL=/
NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL=/

ANTHROPIC_API_KEY=

NEXT_PUBLIC_APP_URL=http://localhost:3000
BACKEND_URL=http://localhost:4000
NEXT_PUBLIC_BACKEND_URL=http://localhost:4000
INTERNAL_WORKER_SECRET=                        # any strong random string
UPSTASH_REDIS_REST_URL=                        # or leave blank for direct Redis
UPSTASH_REDIS_REST_TOKEN=
REDIS_URL=redis://localhost:6379               # if not using Upstash

# Optional
NEXT_PUBLIC_SENTRY_DSN=
SENTRY_ORG=
SENTRY_PROJECT=
SENTRY_AUTH_TOKEN=
```

**`.env`** (backend)

```
ANTHROPIC_API_KEY=
REDIS_URL=redis://localhost:6379
NEXT_PUBLIC_APP_URL=http://localhost:3000
INTERNAL_WORKER_SECRET=                        # must match frontend
RECONCILE_JOB_TIMEOUT_MS=180000
```

### Database

Apply the schema and migrations to your Supabase project:

```sql
-- Run in Supabase SQL editor, in order:
-- 1. docs/schema.sql
-- 2. docs/migrations/2026-05-13-auth-org-scope.sql
```

### Start services

Start Redis (if running locally):

```powershell
docker run -p 6379:6379 redis:7
```

Start the app in three terminals:

```powershell
# Terminal 1 — frontend
npm run dev --workspace=frontend

# Terminal 2 — backend API
npm run dev --workspace=backend

# Terminal 3 — background worker
npm run dev:worker --workspace=backend
```

Frontend: `http://localhost:3000`
Backend: `http://localhost:4000`

---

## Health checks

```powershell
Invoke-RestMethod http://localhost:3000/api/health
Invoke-RestMethod http://localhost:4000/health
```

Reports status of: database, queue, Redis, Sentry configuration, and AI configuration.

---

## Validation

Type check and lint:

```powershell
npx tsc --noEmit --project frontend\tsconfig.json
npm run lint --workspace=frontend
npm run build --workspace=frontend
npm run build --workspace=backend
```

Load test (50,000-row dataset):

```powershell
npm run loadtest:generate
npm run loadtest:match
```

Benchmark: 50,000 charge rows + 50,000 invoice rows parse and exact-match in under one second. Full queued reconciliation with fee schedule in ~12 seconds locally.

---

## Key pages

| Route | Purpose |
|---|---|
| `/` | Dashboard — run stats, summary cards, onboarding checklist |
| `/upload` | 3-step upload flow: file → column mapping → reconcile |
| `/runs` | Run history — all past reconciliation runs |
| `/runs/[id]` | Run detail — results by merchant, by product line, all discrepancies |
| `/audit` | Audit log — all user actions, CSV export |
| `/settings` | Organization settings, invite teammates |

---

## Engineering principles

**The amount is never a match key.** Match on `merchant_id + product_line + fee_type + billing_period`. Amount differences are discrepancies, not non-matches.

**Batch all AI calls.** Claude is never called row-by-row. Fuzzy match candidates are grouped (up to 25 pairs per call). This controls cost and latency at scale.

**Every AI decision is auditable.** Claude's input, output, model, confidence score, and timestamp are logged for every call that affects a discrepancy classification.

**Graceful degradation without a fee schedule.** The 2-file reconciliation catches ~60% of discrepancies. The fee schedule catches the rest. The engine is useful without it and substantially better with it.

**Financial data requires paranoia.** TLS in transit, database encryption at rest, no PII in logs, rate limiting on all reconciliation endpoints, full audit trail from day one.

---

## Roadmap

**Phase 1 — Production MVP** ✅ Complete
Authentication, persistent run history, audit logging, BullMQ background processing, multi-format input, 50k-row scale validation, Sentry monitoring.

**Phase 2 — Workflow Intelligence** (planned)
Assign and resolve discrepancies, email and Slack notifications, Claude-powered root cause classification, trend analytics dashboard, natural language Q&A over reconciliation data.

**Phase 3 — Automation** (planned)
Scheduled daily reconciliation, AI-suggested resolutions with one-click approval, cumulative revenue recovered scorecard, SOC 2 Type I.

**Phase 4 — Integration** (planned)
Native connectors for Salesforce, NetSuite, QuickBooks, SFTP; public REST API and webhooks; multi-entity support; embeddable widget.

**Phase 5 — Platform** (planned)
White-label OEM, SOC 2 Type II, SSO/SAML, dedicated tenant deployment.

See [`docs/ROADMAP.md`](docs/ROADMAP.md) for the full phase breakdown.
