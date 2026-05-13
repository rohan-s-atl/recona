import { NextRequest, NextResponse } from 'next/server'
import { hasRole } from '@/lib/auth'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(_request: NextRequest, { params }: { params: { jobId: string } }) {
  if (!(await hasRole('viewer'))) {
    return NextResponse.json({ error: 'Viewer access required' }, { status: 403 })
  }

  const backendUrl = process.env.BACKEND_URL
  if (!backendUrl) {
    return NextResponse.json({ error: 'Background queue backend is not configured' }, { status: 503 })
  }

  const res = await fetch(`${backendUrl}/api/reconcile/${params.jobId}/status`, {
    cache: 'no-store',
  })
  const data = await res.json().catch(() => ({}))
  return NextResponse.json(data, { status: res.status })
}
