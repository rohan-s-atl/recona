import { NextRequest } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { hasRole } from '@/lib/auth'
import { saveRun } from '@/lib/db'
import { checkRateLimit, getClientIp, rateLimitHeaders } from '@/lib/rateLimit'
import { runReconciliationEngine } from '@/lib/reconcileEngine'
import { ReconcileApiRequest } from '@/types'

export const runtime = 'nodejs'
export const maxDuration = 120

export async function POST(request: NextRequest) {
  if (!(await hasRole('analyst'))) {
    return Response.json({ error: 'Analyst access required' }, { status: 403 })
  }

  const { userId, orgId } = auth()
  const body: ReconcileApiRequest = await request.json()
  const ipAddress = getClientIp(request.headers)
  const rate = checkRateLimit(`reconcile:${orgId ?? userId ?? ipAddress}`, 10, 60 * 60 * 1000)
  if (!rate.allowed) {
    return Response.json(
      { error: 'Too many reconciliation runs. Please try again later.' },
      { status: 429, headers: rateLimitHeaders(rate) }
    )
  }

  const encoder = new TextEncoder()
  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: string, data: unknown) => {
        try {
          controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`))
        } catch {
          // Client disconnected.
        }
      }

      try {
        const engine = await runReconciliationEngine(body, (progress) => send('progress', progress))
        send('progress', { phase: 'saving', label: 'Saving results...' })
        const persistedId = await saveRun({
          result: engine.result,
          chargesFilename: engine.chargesFilename,
          invoicesFilename: engine.invoicesFilename,
          feeScheduleFilename: engine.feeScheduleFilename,
          userId: userId ?? undefined,
          orgId: orgId ?? undefined,
          ipAddress,
        }).catch((err) => {
          console.error('[reconcile] persist failed (non-fatal):', err)
          return null
        })

        send('complete', {
          ...engine.result,
          runId: persistedId ?? engine.result.runId,
          persisted: !!persistedId,
        })
        controller.close()
      } catch (err) {
        console.error('[reconcile]', err)
        send('error', { message: err instanceof Error ? err.message : 'Internal server error' })
        controller.close()
      }
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
      ...rateLimitHeaders(rate),
    },
  })
}
