import { NextResponse } from 'next/server'
import { getDataScope, hasRole } from '@/lib/auth'
import { getRunById } from '@/lib/db'
import { buildRunPdf } from '@/lib/pdfReport'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(_request: Request, { params }: { params: { id: string } }) {
  if (!(await hasRole('viewer'))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const run = await getRunById(params.id, getDataScope())
  if (!run) return NextResponse.json({ error: 'Run not found' }, { status: 404 })

  const pdf = buildRunPdf(run)
  const filename = `recona-report-${run.id.slice(0, 8)}.pdf`

  return new Response(new Uint8Array(pdf), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control': 'private, no-store',
    },
  })
}
