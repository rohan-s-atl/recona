# Recona Launch Checklist

Use this when you want to finish the project without adding paid services unless they are truly needed.

## Free Engineering Items Already in the Repo

- Vercel cron config at `frontend/vercel.json`
- Daily schedule dispatcher: `/api/schedules/dispatch`
- Daily notification dispatcher: `/api/notifications/dispatch`
- GitHub Actions CI: `.github/workflows/ci.yml`
- Scheduled GitHub smoke workflow: `.github/workflows/smoke.yml`
- Smoke tests: `npm run smoke`
- Environment template check: `npm run check:env`
- DB index hardening migration: `docs/migrations/2026-05-14-launch-hardening-indexes.sql`
- Demo workspace seed: `docs/demo-workspace.sql`

## One-Time Setup

1. Run all migrations in Supabase SQL Editor:
   - `docs/schema.sql` for a fresh database, or
   - existing migrations in order, then `docs/migrations/2026-05-14-launch-hardening-indexes.sql`

2. Add `CRON_SECRET` to Vercel.
   - Use a long random value.
   - Vercel Cron sends this as `Authorization: Bearer <CRON_SECRET>`.
   - The dispatch endpoints also still accept `x-worker-secret: INTERNAL_WORKER_SECRET`.

3. Keep these production env vars aligned:
   - Vercel:
     - `NEXT_PUBLIC_APP_URL`
     - `BACKEND_URL`
     - `NEXT_PUBLIC_BACKEND_URL`
     - `INTERNAL_WORKER_SECRET`
     - `CRON_SECRET`
     - Supabase, Clerk, Anthropic, Sentry values
   - Railway API/worker:
     - `NEXT_PUBLIC_APP_URL`
     - `INTERNAL_WORKER_SECRET`
     - `REDIS_URL`
     - `CORS_ORIGINS` set to your Vercel/custom app origin

4. Run smoke tests after deploy:

```bash
RECONA_FRONTEND_URL=https://your-app-domain npm run smoke
```

With backend:

```bash
RECONA_FRONTEND_URL=https://your-app-domain RECONA_BACKEND_URL=https://your-railway-domain npm run smoke
```

With dispatcher auth checks:

```bash
RECONA_FRONTEND_URL=https://your-app-domain RECONA_BACKEND_URL=https://your-railway-domain INTERNAL_WORKER_SECRET=your-secret npm run smoke
```

## Cost-Conscious Notes

- Vercel Hobby supports cron jobs, but only once per day per cron schedule.
- Railway cron is useful for short-lived jobs, but you already have Vercel cron config for free daily dispatch.
- Clerk production requires a custom domain you own; keep development Clerk keys until you are ready to buy/attach one.
- Supabase free tier is fine for a project/demo until you need backups, non-pausing, or more database/storage capacity.

## Final Smoke Path

1. Open `/api/health` on the frontend.
2. Open `/health` on the Railway backend.
3. Run a small reconciliation.
4. Assign one issue from the Issues tab.
5. Confirm the Queue badge updates.
6. Generate/approve one resolution.
7. Confirm the Scorecard updates.
8. Export PDF.
9. Check Sentry for no new errors.

## Optional GitHub Smoke Secrets

Set these repository secrets if you want GitHub to run the scheduled smoke workflow:

- `RECONA_FRONTEND_URL`
- `RECONA_BACKEND_URL`
- `INTERNAL_WORKER_SECRET`

If `RECONA_FRONTEND_URL` is not set, the workflow exits as a no-op instead of failing.
