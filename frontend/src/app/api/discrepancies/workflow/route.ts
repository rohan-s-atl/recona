import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUserLabel, getDataScope, hasRole } from '@/lib/auth'
import { updateDiscrepancyWorkflow } from '@/lib/db'
import type { DiscrepancyStatus, ResolutionType } from '@/types'

export const dynamic = 'force-dynamic'

export async function PATCH(request: NextRequest) {
  if (!(await hasRole('analyst'))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = (await request.json()) as {
    ids?: string[]
    assignedTo?: string | null
    assignmentNote?: string | null
    dueAt?: string | null
    status?: DiscrepancyStatus
    resolutionType?: ResolutionType | null
    resolutionComment?: string | null
  }

  const ids = body.ids?.filter(Boolean) ?? []
  if (ids.length === 0) {
    return NextResponse.json({ error: 'No discrepancies selected' }, { status: 400 })
  }
  if (body.status === 'resolved' && !body.resolutionComment?.trim()) {
    return NextResponse.json({ error: 'Resolution comment is required' }, { status: 400 })
  }

  const actor = await getCurrentUserLabel()
  const rows = await updateDiscrepancyWorkflow({
    ids,
    scope: getDataScope(),
    actorId: actor,
    assignedTo: body.assignedTo,
    assignmentNote: body.assignmentNote,
    dueAt: body.dueAt,
    status: body.status,
    resolutionType: body.resolutionType,
    resolutionComment: body.resolutionComment,
  })

  return NextResponse.json({ updated: rows.length, discrepancies: rows })
}
