import { NextRequest, NextResponse } from 'next/server'
import { getDataScope, hasRole } from '@/lib/auth'
import { collectComplianceEvidence, enforceRetention, getComplianceControls, updateComplianceControls } from '@/lib/db'

export const dynamic = 'force-dynamic'

export async function GET() {
  const controls = await getComplianceControls(getDataScope())
  return NextResponse.json(controls)
}

export async function PATCH(request: NextRequest) {
  if (!(await hasRole('admin'))) {
    return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
  }
  const body = (await request.json()) as {
    retentionDays?: number
    autoDeleteEnabled?: boolean
    soc2ProcessStarted?: boolean
    evidenceCollectionEnabled?: boolean
    dataProcessingRegion?: string
  }
  const controls = await updateComplianceControls(getDataScope(), {
    retention_days: body.retentionDays,
    auto_delete_enabled: body.autoDeleteEnabled,
    soc2_process_started_at: body.soc2ProcessStarted ? new Date().toISOString() : undefined,
    evidence_collection_enabled: body.evidenceCollectionEnabled,
    data_processing_region: body.dataProcessingRegion,
  })
  if (!controls) return NextResponse.json({ error: 'Unable to save controls' }, { status: 500 })
  return NextResponse.json(controls)
}

export async function POST(request: NextRequest) {
  if (!(await hasRole('admin'))) {
    return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
  }
  const body = (await request.json().catch(() => ({}))) as { action?: 'collect_evidence' | 'enforce_retention' }
  if (body.action === 'enforce_retention') {
    const result = await enforceRetention(getDataScope())
    return NextResponse.json(result)
  }
  const collected = await collectComplianceEvidence(getDataScope())
  return NextResponse.json({ collected })
}
