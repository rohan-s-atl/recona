import { NextRequest, NextResponse } from 'next/server'
import { hasRole } from '@/lib/auth'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(_request: NextRequest, { params }: { params: { id: string } }) {
  if (!(await hasRole('viewer'))) {
    return NextResponse.json({ error: 'Viewer access required' }, { status: 403 })
  }

  const backendUrl = process.env.BACKEND_URL
  const workerSecret = process.env.INTERNAL_WORKER_SECRET
  if (!backendUrl || !workerSecret) {
    return NextResponse.json({ error: 'Background queue backend is not configured' }, { status: 503 })
  }

  const res = await fetch(`${backendUrl}/api/reconcile/${params.id}/status`, {
    cache: 'no-store',
    headers: { 'x-worker-secret': workerSecret },
  })
  const data = await res.json().catch(() => ({}))
  return NextResponse.json(data, { status: res.status })
}
