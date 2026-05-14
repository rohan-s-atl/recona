import { timingSafeEqual } from 'crypto'
import { NextRequest } from 'next/server'

export function safeSecretEquals(actual: string | null | undefined, expected: string | null | undefined): boolean {
  if (!actual || !expected) return false
  const actualBuffer = Buffer.from(actual)
  const expectedBuffer = Buffer.from(expected)
  if (actualBuffer.length !== expectedBuffer.length) return false
  return timingSafeEqual(actualBuffer, expectedBuffer)
}

export function isAuthorizedWorkerRequest(request: NextRequest): boolean {
  return safeSecretEquals(request.headers.get('x-worker-secret'), process.env.INTERNAL_WORKER_SECRET)
}

export function isAuthorizedInternalWorkerRequest(request: NextRequest): boolean {
  return safeSecretEquals(request.headers.get('x-internal-worker-secret'), process.env.INTERNAL_WORKER_SECRET)
}

export function isAuthorizedCronRequest(request: NextRequest): boolean {
  const bearerToken = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '')
  return safeSecretEquals(bearerToken, process.env.CRON_SECRET)
}
