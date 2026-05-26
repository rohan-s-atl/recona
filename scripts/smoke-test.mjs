#!/usr/bin/env node

const frontendUrl = stripTrailingSlash(process.env.RECONA_FRONTEND_URL || process.env.NEXT_PUBLIC_APP_URL || '')
const backendUrl = stripTrailingSlash(process.env.RECONA_BACKEND_URL || process.env.NEXT_PUBLIC_BACKEND_URL || process.env.BACKEND_URL || '')
const workerSecret = process.env.INTERNAL_WORKER_SECRET || ''

const checks = [
  frontendUrl && {
    name: 'frontend health',
    method: 'GET',
    url: `${frontendUrl}/api/health`,
    validate: (json) => json?.status === 'ok' || json?.status === 'degraded',
  },
  frontendUrl && {
    name: 'frontend landing',
    method: 'GET',
    url: frontendUrl,
    expectOk: true,
  },
  backendUrl && {
    name: 'backend health',
    method: 'GET',
    url: `${backendUrl}/health`,
    expectOk: true,
    validate: (json) => json.status === 'ok',
  },
  frontendUrl && workerSecret && {
    name: 'schedule dispatcher auth',
    method: 'GET',
    url: `${frontendUrl}/api/schedules/dispatch`,
    headers: { 'x-worker-secret': workerSecret },
    expectOk: true,
  },
  frontendUrl && workerSecret && {
    name: 'notification dispatcher auth',
    method: 'GET',
    url: `${frontendUrl}/api/notifications/dispatch`,
    headers: { 'x-worker-secret': workerSecret },
    expectOk: true,
  },
].filter(Boolean)

if (checks.length === 0) {
  fail('No smoke test URLs configured. Set RECONA_FRONTEND_URL and/or RECONA_BACKEND_URL.')
}

let failed = 0

for (const check of checks) {
  const started = Date.now()
  try {
    const response = await fetch(check.url, {
      method: check.method,
      headers: check.headers,
      cache: 'no-store',
    })
    const text = await response.text()
    const json = parseJson(text)
    const ok = check.expectOk ? response.ok : true
    const valid = check.validate ? check.validate(json ?? text, response) : true
    if (!ok || !valid) {
      failed += 1
      console.error(`FAIL ${check.name}: ${response.status} ${response.statusText}`)
      if (text) console.error(text.slice(0, 600))
    } else {
      console.log(`PASS ${check.name} (${Date.now() - started}ms)`)
    }
  } catch (error) {
    failed += 1
    console.error(`FAIL ${check.name}: ${error instanceof Error ? error.message : String(error)}`)
  }
}

if (failed > 0) {
  process.exitCode = 1
  console.error(`${failed} smoke check(s) failed.`)
} else {
  console.log(`All ${checks.length} smoke check(s) passed.`)
}

function stripTrailingSlash(value) {
  return value.replace(/\/+$/, '')
}

function parseJson(text) {
  try {
    return JSON.parse(text)
  } catch {
    return null
  }
}

function fail(message) {
  console.error(message)
  process.exit(1)
}
