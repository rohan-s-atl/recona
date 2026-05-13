# Recona

Recona is an AI-assisted billing reconciliation platform for financial services teams. It compares product charge exports, invoice exports, and optional fee schedules to find revenue leakage, overbilling, plan mismatches, missing contracted fees, and other billing control issues in minutes.

Phase 1 is production-hardened: authenticated upload flows, multi-format parsing, large-file support, background reconciliation jobs, persisted run history, audit logging, monitoring, and 50,000-row performance validation are in place.

## Product Surface

- Upload charges, invoices, and optional fee schedules
- Accept CSV, TSV, Excel (`.xlsx` / `.xls`), ODS, and JSON array files
- Use AI-assisted column mapping for messy customer exports
- Reconcile exact matches, amount mismatches, missing billing rows, missing charge rows, rate mismatches, plan mismatches, and missing contracted fees
- Run large reconciliations in the background with Redis/BullMQ
- Track live phase progress while jobs run
- Persist completed runs with permanent result URLs
- View run history, audit activity, settings, and invitation workflows
- Generate executive summaries and PDF-ready reports
- Monitor app health and production errors with Sentry

## Architecture

```text
frontend/   Next.js app, API routes, UI, reconciliation engine
backend/    Express API, Redis queue, reconciliation worker
ai/         Shared AI utilities
docs/       Schema, migrations, roadmap, test data, load-test data
scripts/    Local load-test and benchmark helpers
```

## Stack

| Area | Technology |
| --- | --- |
| Frontend | Next.js 14, React, Tailwind CSS |
| Backend | Node.js, TypeScript, Express |
| Queue | Redis, BullMQ |
| Database | Supabase/Postgres |
| Auth | Clerk |
| AI | Anthropic Claude |
| Monitoring | Sentry |
| Parsing | Papa Parse, SheetJS |

## Local Setup

Install dependencies:

```powershell
npm install
```

Create local env files:

```powershell
Copy-Item .env.example .env
Copy-Item frontend\.env.example frontend\.env.local
```

Required local services and keys:

- Supabase project with `docs/schema.sql` and migrations applied
- Clerk app keys
- Anthropic API key
- Sentry project values if monitoring is enabled
- Redis for background jobs

Start Redis:

```powershell
docker run -p 6379:6379 redis:7
```

Start the app in separate terminals:

```powershell
npm run dev --workspace=frontend
npm run dev --workspace=backend
npm run dev:worker --workspace=backend
```

Frontend runs on `http://localhost:3000`; backend runs on `http://localhost:4000`.

## Health Checks

```powershell
Invoke-RestMethod http://localhost:3000/api/health
Invoke-RestMethod http://localhost:4000/health
```

Expected result: database, queue, Redis, Sentry, and AI configuration report as available/configured based on local env settings.

## Validation

Run frontend checks:

```powershell
npx tsc --noEmit --project frontend\tsconfig.json
npm run lint --workspace=frontend
npm run build --workspace=frontend
```

Run backend build:

```powershell
npm run build --workspace=backend
```

Generate and benchmark the 50,000-row load test:

```powershell
npm run loadtest:generate
npm run loadtest:match
```

Latest local benchmark: 50,000 charge rows and 50,000 invoice rows parsed and exact-matched in under one second for the core matching hot path. A full queued 50,000-row reconciliation with fee schedule completed successfully in about 12 seconds locally.

## Phase 1 Status

Phase 1 is complete.

- Core reconciliation workflow is implemented
- Multi-format input support is implemented
- Supabase persistence and run history are implemented
- Clerk auth scaffolding and org/user scoping are implemented
- Audit logging is implemented
- Sentry monitoring and source map upload are implemented
- Redis/BullMQ background processing is implemented
- 50,000-row load target is validated
- Production build passes

See `docs/ROADMAP.md` for the detailed roadmap.
