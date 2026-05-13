import { Job, Queue } from 'bullmq'

export interface ReconcileJobPayload {
  chargesFileId: string
  invoicesFileId: string
  chargesMapping: Record<string, string | null>
  invoicesMapping: Record<string, string | null>
  feeScheduleFileId?: string
  userId?: string
  orgId?: string
  ipAddress?: string
}

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

export const queueAvailable = Boolean(connection)

export const reconcileQueue = connection
  ? new Queue<ReconcileJobPayload>('reconciliation', {
      connection,
      defaultJobOptions: {
        attempts: 2,
        backoff: { type: 'exponential', delay: 5000 },
        removeOnComplete: { age: 7 * 24 * 60 * 60 },
        removeOnFail: { age: 30 * 24 * 60 * 60 },
      },
    })
  : null

export async function addReconcileJob(payload: ReconcileJobPayload): Promise<Job<ReconcileJobPayload>> {
  if (!reconcileQueue) throw new Error('Redis queue is not configured')
  return reconcileQueue.add('run', payload)
}

export async function getReconcileJob(jobId: string) {
  if (!reconcileQueue) throw new Error('Redis queue is not configured')
  return reconcileQueue.getJob(jobId)
}
