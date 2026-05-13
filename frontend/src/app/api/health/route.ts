import { NextResponse } from 'next/server'
import { getSupabaseClient, isSupabaseConfigured } from '@/lib/supabase'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

async function checkDb(): Promise<'ok' | 'not_configured' | 'error'> {
  if (!isSupabaseConfigured()) return 'not_configured'

  const db = getSupabaseClient()
  if (!db) return 'not_configured'

  try {
    const { error } = await db.from('reconciliation_runs').select('id').limit(1)
    return error ? 'error' : 'ok'
  } catch {
    return 'error'
  }
}

async function checkQueue(): Promise<'configured' | 'not_configured' | 'error'> {
  if (!process.env.BACKEND_URL) return 'not_configured'

  try {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 3000)
    const res = await fetch(`${process.env.BACKEND_URL}/health`, {
      cache: 'no-store',
      signal: controller.signal,
    })
    clearTimeout(timer)

    if (!res.ok) return 'error'
    const data = (await res.json()) as { checks?: { queue?: string } }
    return data.checks?.queue === 'configured' ? 'configured' : 'not_configured'
  } catch {
    return 'error'
  }
}

export async function GET() {
  const [db, queue] = await Promise.all([checkDb(), checkQueue()])
  const status = db === 'error' || queue === 'error' ? 503 : 200

  return NextResponse.json(
    {
      status: status === 200 ? 'ok' : 'degraded',
      timestamp: new Date().toISOString(),
      checks: {
        database: db,
        queue,
        sentry: process.env.NEXT_PUBLIC_SENTRY_DSN ? 'configured' : 'not_configured',
        ai: process.env.ANTHROPIC_API_KEY ? 'configured' : 'not_configured',
      },
    },
    { status }
  )
}
