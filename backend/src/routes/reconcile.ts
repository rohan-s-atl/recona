import { Router } from 'express'
import { timingSafeEqual } from 'crypto'
import { addReconcileJob, getReconcileJob, queueAvailable } from '../queue'

export const reconcileRouter = Router()

reconcileRouter.post('/', async (req, res) => {
  if (!isAuthorizedWorkerRequest(req.header('x-worker-secret'))) {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  if (!queueAvailable) {
    return res.status(503).json({ error: 'Redis queue is not configured' })
  }

  const {
    chargesFileId,
    invoicesFileId,
    chargesMapping,
    invoicesMapping,
    feeScheduleFileId,
    userId,
    orgId,
    ipAddress,
  } = req.body ?? {}

  if (!chargesFileId || !invoicesFileId || !chargesMapping || !invoicesMapping) {
    return res.status(400).json({
      error: 'chargesFileId, invoicesFileId, chargesMapping, and invoicesMapping are required',
    })
  }

  const job = await addReconcileJob({
    chargesFileId,
    invoicesFileId,
    chargesMapping,
    invoicesMapping,
    feeScheduleFileId,
    userId,
    orgId,
    ipAddress,
  })
  return res.status(202).json({ jobId: job.id, status: 'queued' })
})

reconcileRouter.get('/:jobId/status', async (req, res) => {
  if (!isAuthorizedWorkerRequest(req.header('x-worker-secret'))) {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  if (!queueAvailable) {
    return res.status(503).json({ error: 'Redis queue is not configured' })
  }

  const job = await getReconcileJob(req.params.jobId)
  if (!job) return res.status(404).json({ error: 'Job not found' })

  return res.json({
    jobId: job.id,
    state: await job.getState(),
    progress: job.progress,
    failedReason: job.failedReason,
    returnvalue: job.returnvalue,
  })
})

function isAuthorizedWorkerRequest(actual: string | undefined): boolean {
  const expected = process.env.INTERNAL_WORKER_SECRET
  if (!actual || !expected) return false

  const actualBuffer = Buffer.from(actual)
  const expectedBuffer = Buffer.from(expected)
  if (actualBuffer.length !== expectedBuffer.length) return false

  return timingSafeEqual(actualBuffer, expectedBuffer)
}
