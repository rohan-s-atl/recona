import { NextRequest, NextResponse } from 'next/server'
import { saveRun } from '@/lib/db'
import { runReconciliationEngine } from '@/lib/reconcileEngine'
import { isAuthorizedInternalWorkerRequest } from '@/lib/security'
import type { ReconcileApiRequest } from '@/types'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 120

export async function POST(request: NextRequest) {
  if (!isAuthorizedInternalWorkerRequest(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = (await request.json()) as ReconcileApiRequest & {
    userId?: string
    orgId?: string
    ipAddress?: string
  }

  const startedAt = Date.now()
  const engine = await runReconciliationEngine(body, (progress) => {
    const elapsed = `${Date.now() - startedAt}ms`
    const detail = progress.detail ? ` - ${progress.detail}` : ''
    console.log(`[reconcile:internal] ${progress.phase} ${progress.label}${detail} (${elapsed})`)
  })
  const persistedId = await saveRun({
    result: engine.result,
    chargesFilename: engine.chargesFilename,
    invoicesFilename: engine.invoicesFilename,
    feeScheduleFilename: engine.feeScheduleFilename,
    userId: body.userId,
    orgId: body.orgId,
    ipAddress: body.ipAddress,
  })

  return NextResponse.json({
    ...engine.result,
    runId: persistedId ?? engine.result.runId,
    persisted: !!persistedId,
  })
}
