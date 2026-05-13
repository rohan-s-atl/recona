import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { hasRole } from '@/lib/auth'
import { checkRateLimit, getClientIp, rateLimitHeaders } from '@/lib/rateLimit'
import type { ReconcileApiRequest } from '@/types'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  if (!(await hasRole('analyst'))) {
    return NextResponse.json({ error: 'Analyst access required' }, { status: 403 })
  }

  const backendUrl = process.env.BACKEND_URL
  if (!backendUrl) {
    return NextResponse.json({ error: 'Background queue backend is not configured' }, { status: 503 })
  }

  const { userId, orgId } = auth()
  const ipAddress = getClientIp(request.headers)
  const rate = checkRateLimit(`reconcile-queued:${orgId ?? userId ?? ipAddress}`, 10, 60 * 60 * 1000)
  if (!rate.allowed) {
    return NextResponse.json(
      { error: 'Too many reconciliation runs. Please try again later.' },
      { status: 429, headers: rateLimitHeaders(rate) }
    )
  }

  const body: ReconcileApiRequest = await request.json()
  const res = await fetch(`${backendUrl}/api/reconcile`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      ...body,
      userId,
      orgId,
      ipAddress,
    }),
  })

  const data = await res.json().catch(() => ({}))
  return NextResponse.json(data, { status: res.status, headers: rateLimitHeaders(rate) })
}
