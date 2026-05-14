import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUserLabel, getDataScope, hasRole } from '@/lib/auth'
import { createShareLink } from '@/lib/db'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  if (!(await hasRole('viewer'))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = (await request.json()) as { runId?: string; ttlDays?: number }
  if (!body.runId) return NextResponse.json({ error: 'runId is required' }, { status: 400 })
  if (body.ttlDays !== undefined && (!Number.isFinite(body.ttlDays) || body.ttlDays < 1 || body.ttlDays > 30)) {
    return NextResponse.json({ error: 'ttlDays must be between 1 and 30' }, { status: 400 })
  }

  const link = await createShareLink({
    runId: body.runId,
    scope: getDataScope(),
    createdBy: await getCurrentUserLabel(),
    ttlDays: body.ttlDays,
  })
  if (!link) return NextResponse.json({ error: 'Unable to create share link' }, { status: 404 })

  return NextResponse.json(link)
}
