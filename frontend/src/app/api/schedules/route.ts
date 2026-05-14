import { NextRequest, NextResponse } from 'next/server'
import { getDataScope, hasRole } from '@/lib/auth'
import { createReconciliationSchedule, getReconciliationSchedules } from '@/lib/db'
import type { ReconciliationCadence } from '@/types'

export const dynamic = 'force-dynamic'

export async function GET() {
  const schedules = await getReconciliationSchedules(getDataScope())
  return NextResponse.json({ schedules })
}

export async function POST(request: NextRequest) {
  if (!(await hasRole('analyst'))) {
    return NextResponse.json({ error: 'Analyst access required' }, { status: 403 })
  }
  const body = (await request.json()) as {
    name?: string
    cadence?: ReconciliationCadence
    timezone?: string
    runAtLocal?: string
    productLine?: string | null
    catchFastEnabled?: boolean
    rollingWindowDays?: number
    chargesSnapshotId?: string
    invoicesSnapshotId?: string
    feeScheduleSnapshotId?: string | null
    chargesMapping?: Record<string, string | null>
    invoicesMapping?: Record<string, string | null>
  }
  if (!body.name || !body.cadence || !body.chargesSnapshotId || !body.invoicesSnapshotId || !body.chargesMapping || !body.invoicesMapping) {
    return NextResponse.json({ error: 'Missing schedule fields' }, { status: 400 })
  }
  const schedule = await createReconciliationSchedule({
    scope: getDataScope(),
    name: body.name,
    cadence: body.cadence,
    timezone: body.timezone,
    runAtLocal: body.runAtLocal,
    productLine: body.productLine,
    catchFastEnabled: body.catchFastEnabled,
    rollingWindowDays: body.rollingWindowDays,
    chargesSnapshotId: body.chargesSnapshotId,
    invoicesSnapshotId: body.invoicesSnapshotId,
    feeScheduleSnapshotId: body.feeScheduleSnapshotId,
    chargesMapping: body.chargesMapping,
    invoicesMapping: body.invoicesMapping,
  })
  if (!schedule) return NextResponse.json({ error: 'Unable to create schedule' }, { status: 500 })
  return NextResponse.json(schedule)
}
