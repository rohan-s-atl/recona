import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUserLabel, getDataScope, hasRole } from '@/lib/auth'
import { approveResolutionSuggestions, getResolutionSuggestions } from '@/lib/db'

export const dynamic = 'force-dynamic'

export async function GET() {
  const suggestions = await getResolutionSuggestions(getDataScope())
  return NextResponse.json({ suggestions })
}

export async function PATCH(request: NextRequest) {
  if (!(await hasRole('analyst'))) {
    return NextResponse.json({ error: 'Analyst access required' }, { status: 403 })
  }
  const body = (await request.json()) as { ids?: string[]; action?: 'approve' }
  if (body.action !== 'approve' || !body.ids?.length) {
    return NextResponse.json({ error: 'ids and approve action are required' }, { status: 400 })
  }
  const approved = await approveResolutionSuggestions({
    ids: body.ids,
    actorId: await getCurrentUserLabel(),
    scope: getDataScope(),
  })
  return NextResponse.json({ approved })
}
