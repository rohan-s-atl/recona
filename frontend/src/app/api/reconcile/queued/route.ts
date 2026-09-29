import { NextRequest, NextResponse } from 'next/server'
import { getCurrentAuth, hasRole } from '@/lib/auth'
import { checkRateLimit, getClientIp, rateLimitHeaders } from '@/lib/rateLimit'
import type { ReconcileApiRequest } from '@/types'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  if (!(await hasRole('analyst'))) {
    return NextResponse.json({ error: 'Analyst access required' }, { status: 403 })
  }

  const backendUrl = process.env.BACKEND_URL
  const workerSecret = process.env.INTERNAL_WORKER_SECRET
  if (!backendUrl || !workerSecret) {
    return NextResponse.json({ error: 'Background queue backend is not configured' }, { status: 503 })
  }

  const { userId, orgId } = getCurrentAuth()
  const ipAddress = getClientIp(request.headers)
  const rate = checkRateLimit(`reconcile-queued:${orgId ?? userId ?? ipAddress}`, 10, 60 * 60 * 1000)
  if (!rate.allowed) {
    return NextResponse.json(
      { error: 'Too many reconciliation runs. Please try again later.' },
      { status: 429, headers: rateLimitHeaders(rate) }
    )
  }

  const body: ReconcileApiRequest = await request.json()
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 10_000)
  let res: Response
  try {
    res = await fetch(`${backendUrl}/api/reconcile`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-worker-secret': workerSecret },
      body: JSON.stringify({
        ...body,
        userId,
        orgId,
        ipAddress,
      }),
      signal: controller.signal,
    })
  } catch (error) {
    const message = error instanceof Error && error.name === 'AbortError'
      ? 'Background queue backend timed out'
      : 'Background queue backend is unavailable'
    return NextResponse.json({ error: message }, { status: 503, headers: rateLimitHeaders(rate) })
  } finally {
    clearTimeout(timeout)
  }

  const data = await res.json().catch(() => ({}))
  return NextResponse.json(data, { status: res.status, headers: rateLimitHeaders(rate) })
}
