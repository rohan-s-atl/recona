import './env'
import { Worker } from 'bullmq'
import { queueAvailable, ReconcileJobPayload } from './queue'

function redisConnection() {
  const redisUrl = process.env.REDIS_URL
  if (!redisUrl) return null

  const url = new URL(redisUrl)
  return {
    host: url.hostname,
    port: Number(url.port || 6379),
    username: url.username || undefined,
    password: url.password || undefined,
    tls: url.protocol === 'rediss:' ? {} : undefined,
  }
}

const connection = redisConnection()

if (!queueAvailable || !connection) {
  throw new Error('REDIS_URL is required to start the reconciliation worker')
}

if (!process.env.NEXT_PUBLIC_APP_URL || !process.env.INTERNAL_WORKER_SECRET) {
  throw new Error('NEXT_PUBLIC_APP_URL and INTERNAL_WORKER_SECRET are required for worker callbacks')
}

const WORKER_CALLBACK_TIMEOUT_MS = Number(process.env.RECONCILE_JOB_TIMEOUT_MS ?? 180000)

const worker = new Worker<ReconcileJobPayload>(
  'reconciliation',
  async (job) => {
    await job.updateProgress({ phase: 'processing', detail: 'Starting reconciliation' })

    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), WORKER_CALLBACK_TIMEOUT_MS)
    let res: Response

    try {
      res = await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/reconcile/internal`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-internal-worker-secret': process.env.INTERNAL_WORKER_SECRET!,
        },
        body: JSON.stringify(job.data),
        signal: controller.signal,
      })
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error(`Worker callback timed out after ${WORKER_CALLBACK_TIMEOUT_MS}ms`)
      }
      throw error
    } finally {
      clearTimeout(timeout)
    }

    const data = (await res.json().catch(() => ({}))) as { error?: string; runId?: string }
    if (!res.ok) {
      throw new Error(data.error ?? `Worker callback failed with ${res.status}`)
    }

    await job.updateProgress({ phase: 'complete', runId: data.runId })
    return data
  },
  { connection }
)

worker.on('completed', (job) => {
  console.log(`[worker] reconciliation job ${job.id} completed`)
})

worker.on('failed', (job, error) => {
  console.error(`[worker] reconciliation job ${job?.id ?? 'unknown'} failed`, error)
})
