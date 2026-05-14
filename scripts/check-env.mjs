#!/usr/bin/env node

import { existsSync, readFileSync } from 'fs'
import { resolve } from 'path'

const args = new Set(process.argv.slice(2))
const mode = args.has('--mode=example') ? 'example' : 'runtime'
const root = process.cwd()
const envPath = resolve(root, mode === 'example' ? 'frontend/.env.example' : 'frontend/.env.local')

const requiredRuntime = [
  'ANTHROPIC_API_KEY',
  'NEXT_PUBLIC_SUPABASE_URL',
  'NEXT_PUBLIC_SUPABASE_ANON_KEY',
  'SUPABASE_SERVICE_ROLE_KEY',
  'NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY',
  'CLERK_SECRET_KEY',
  'NEXT_PUBLIC_APP_URL',
  'BACKEND_URL',
  'NEXT_PUBLIC_BACKEND_URL',
  'INTERNAL_WORKER_SECRET',
  'SHARE_LINK_SECRET',
]

const recommendedRuntime = [
  'REDIS_URL',
  'NEXT_PUBLIC_SENTRY_DSN',
  'SENTRY_ORG',
  'SENTRY_PROJECT',
  'CRON_SECRET',
]

const exampleOnly = [...requiredRuntime, ...recommendedRuntime]
const keys = mode === 'example' ? exampleOnly : requiredRuntime

if (!existsSync(envPath)) {
  console.error(`Missing ${envPath}`)
  process.exit(1)
}

const parsed = parseEnv(readFileSync(envPath, 'utf8'))
const missing = keys.filter((key) => !(key in parsed))
const weak = mode === 'runtime'
  ? Object.entries(parsed)
      .filter(([key, value]) =>
        ['INTERNAL_WORKER_SECRET', 'SHARE_LINK_SECRET', 'CRON_SECRET'].includes(key) &&
        value &&
        ['change-me', 'change-me-to-a-long-random-secret', 'same-secret-as-vercel'].includes(value)
      )
      .map(([key]) => key)
  : []

if (missing.length > 0) {
  console.error(`Missing env key(s) in ${envPath}: ${missing.join(', ')}`)
}

if (weak.length > 0) {
  console.error(`Replace placeholder secret(s) in ${envPath}: ${weak.join(', ')}`)
}

if (missing.length > 0 || weak.length > 0) {
  process.exit(1)
}

console.log(`${mode === 'example' ? 'Example' : 'Runtime'} env check passed for ${envPath}`)

function parseEnv(text) {
  const result = {}
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const index = trimmed.indexOf('=')
    if (index === -1) continue
    const key = trimmed.slice(0, index).trim()
    const value = trimmed.slice(index + 1).trim()
    result[key] = value
  }
  return result
}
