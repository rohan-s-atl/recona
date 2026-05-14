import { NextRequest, NextResponse } from 'next/server'
import { randomUUID } from 'crypto'
import {
  claimReconciliationSchedule,
  getDueReconciliationSchedules,
  getSourceSnapshotById,
  markScheduleRun,
  saveRun,
} from '@/lib/db'
import { runReconciliationEngine } from '@/lib/reconcileEngine'
import { storeFeeSchedule, storeFile } from '@/lib/fileStore'
import type { ColumnMapping, FeeScheduleRecord, ReconcileApiRequest } from '@/types'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 120

export async function POST(request: NextRequest) {
  const expectedSecret = process.env.INTERNAL_WORKER_SECRET
  const providedSecret = request.headers.get('x-worker-secret')
  if (!expectedSecret || providedSecret !== expectedSecret) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const schedules = await getDueReconciliationSchedules(10)
  const results: { scheduleId: string; runId?: string; error?: string }[] = []
  const workerId = `scheduler:${randomUUID()}`

  for (const dueSchedule of schedules) {
    const schedule = await claimReconciliationSchedule(dueSchedule.id, workerId)
    if (!schedule) {
      results.push({ scheduleId: dueSchedule.id, error: 'Already claimed by another worker' })
      continue
    }
    try {
      const charges = await getSourceSnapshotById(schedule.charges_snapshot_id)
      const invoices = await getSourceSnapshotById(schedule.invoices_snapshot_id)
      const feeSchedule = schedule.fee_schedule_snapshot_id
        ? await getSourceSnapshotById(schedule.fee_schedule_snapshot_id)
        : null
      if (!charges || !invoices) throw new Error('Schedule source snapshot missing')
      const now = Date.now()
      if (charges.expires_at && new Date(charges.expires_at).getTime() < now) throw new Error('Charges snapshot expired')
      if (invoices.expires_at && new Date(invoices.expires_at).getTime() < now) throw new Error('Invoices snapshot expired')
      if (feeSchedule?.expires_at && new Date(feeSchedule.expires_at).getTime() < now) {
        throw new Error('Fee schedule snapshot expired')
      }

      const chargesFileId = randomUUID()
      const invoicesFileId = randomUUID()
      const feeScheduleFileId = feeSchedule ? randomUUID() : undefined
      storeFile(chargesFileId, {
        filename: charges.filename,
        sizeBytes: JSON.stringify(charges.rows).length,
        parsed: { headers: charges.headers, rows: charges.rows },
      })
      storeFile(invoicesFileId, {
        filename: invoices.filename,
        sizeBytes: JSON.stringify(invoices.rows).length,
        parsed: { headers: invoices.headers, rows: invoices.rows },
      })
      if (feeSchedule && feeScheduleFileId) {
        storeFeeSchedule(feeScheduleFileId, {
          filename: feeSchedule.filename,
          records: feeSchedule.rows as unknown as FeeScheduleRecord[],
        })
      }

      const requestBody: ReconcileApiRequest = {
        chargesFileId,
        invoicesFileId,
        feeScheduleFileId,
        chargesMapping: schedule.charges_mapping as unknown as ColumnMapping,
        invoicesMapping: schedule.invoices_mapping as unknown as ColumnMapping,
      }
      const engine = await runReconciliationEngine(requestBody)
      const runId = await saveRun({
        result: engine.result,
        chargesFilename: engine.chargesFilename,
        invoicesFilename: engine.invoicesFilename,
        feeScheduleFilename: engine.feeScheduleFilename,
        scheduleId: schedule.id,
        userId: schedule.user_id ?? undefined,
        orgId: schedule.org_id ?? undefined,
        ipAddress: 'scheduler',
      })
      await markScheduleRun(schedule, { runId })
      results.push({ scheduleId: schedule.id, runId: runId ?? undefined })
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Scheduled reconciliation failed'
      await markScheduleRun(schedule, { error: message })
      results.push({ scheduleId: schedule.id, error: message })
    }
  }

  return NextResponse.json({ processed: results.length, results })
}
