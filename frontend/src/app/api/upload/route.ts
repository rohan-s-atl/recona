import { NextRequest, NextResponse } from 'next/server'
import { v4 as uuidv4 } from 'uuid'
import { parseFileFromBuffer } from '@/lib/fileParser'
import { inferColumnMapping } from '@/lib/claude'
import { storeFile } from '@/lib/fileStore'
import {
  isSupportedFileExtension,
  MAX_UPLOAD_BYTES,
  MAX_UPLOAD_LABEL,
  SUPPORTED_FILE_TYPES_LABEL,
} from '@/lib/uploadConfig'
import { getCurrentAuth, hasRole } from '@/lib/auth'
import { createSourceSnapshot, logAudit } from '@/lib/db'
import { checkRateLimit, getClientIp, rateLimitHeaders } from '@/lib/rateLimit'

export const runtime = 'nodejs'
export const maxDuration = 60

export async function POST(request: NextRequest) {
  try {
    if (!(await hasRole('analyst'))) {
      return NextResponse.json({ error: 'Analyst access required' }, { status: 403 })
    }

    const { userId, orgId } = getCurrentAuth()
    const ipAddress = getClientIp(request.headers)
    const rate = checkRateLimit(`upload:${orgId ?? userId ?? ipAddress}`, 20, 60 * 60 * 1000)
    if (!rate.allowed) {
      return NextResponse.json(
        { error: 'Too many uploads. Please try again later.' },
        { status: 429, headers: rateLimitHeaders(rate) }
      )
    }

    const formData = await request.formData()
    const file = formData.get('file') as File | null

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    }

    if (!isSupportedFileExtension(file.name)) {
      return NextResponse.json(
        { error: `Unsupported file type. Upload ${SUPPORTED_FILE_TYPES_LABEL}.` },
        { status: 400 }
      )
    }

    if (file.size > MAX_UPLOAD_BYTES) {
      return NextResponse.json({ error: `File too large (max ${MAX_UPLOAD_LABEL})` }, { status: 400 })
    }

    const buffer = Buffer.from(await file.arrayBuffer())
    const parsed = parseFileFromBuffer(buffer, file.name)

    if (parsed.rows.length === 0) {
      return NextResponse.json({ error: 'File appears to be empty' }, { status: 400 })
    }

    const suggestedMapping = await inferColumnMapping(parsed.headers, parsed.rows)

    const role = formData.get('role')
    const snapshot =
      role === 'charges' || role === 'invoices'
        ? await createSourceSnapshot({
            scope: { userId: userId ?? undefined, orgId: orgId ?? undefined },
            role,
            name: file.name,
            filename: file.name,
            parsed,
            mapping: { ...suggestedMapping },
            retentionDays: 90,
          })
        : null
    const fileId = snapshot?.id ?? uuidv4()
    storeFile(fileId, {
      filename: file.name,
      sizeBytes: file.size,
      parsed,
    })

    await logAudit({
      action: 'file_uploaded',
      userId: userId ?? undefined,
      orgId: orgId ?? undefined,
      ipAddress,
      metadata: {
        role,
        filename: file.name,
        size_bytes: file.size,
        row_count: parsed.rows.length,
        column_count: parsed.headers.length,
      },
    })

    return NextResponse.json(
      {
        fileId,
        filename: file.name,
        sizeBytes: file.size,
        headers: parsed.headers,
        sample: parsed.rows.slice(0, 5),
        rowsCount: parsed.rows.length,
        suggestedMapping,
      },
      { headers: rateLimitHeaders(rate) }
    )
  } catch (err) {
    console.error('[upload]', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal server error' },
      { status: 500 }
    )
  }
}
