import { NextRequest, NextResponse } from 'next/server'
import { v4 as uuidv4 } from 'uuid'
import { parseFileFromBuffer } from '@/lib/fileParser'
import { parseFeeSchedule } from '@/lib/rateChecker'
import { storeFeeSchedule } from '@/lib/fileStore'
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
export const maxDuration = 30

export async function POST(request: NextRequest) {
  try {
    if (!(await hasRole('analyst'))) {
      return NextResponse.json({ error: 'Analyst access required' }, { status: 403 })
    }

    const { userId, orgId } = getCurrentAuth()
    const ipAddress = getClientIp(request.headers)
    const rate = checkRateLimit(`fee-schedule:${orgId ?? userId ?? ipAddress}`, 20, 60 * 60 * 1000)
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
      return NextResponse.json({ error: `Unsupported file type. Upload ${SUPPORTED_FILE_TYPES_LABEL}.` }, { status: 400 })
    }

    if (file.size > MAX_UPLOAD_BYTES) {
      return NextResponse.json({ error: `File too large (max ${MAX_UPLOAD_LABEL})` }, { status: 400 })
    }

    const buffer = Buffer.from(await file.arrayBuffer())
    const parsed = parseFileFromBuffer(buffer, file.name)

    // Normalise headers to snake_case for parseFeeSchedule
    const normalisedRows = parsed.rows.map((row) => {
      const out: Record<string, string> = {}
      for (const [k, v] of Object.entries(row)) {
        out[k.toLowerCase().replace(/\s+/g, '_')] = v
      }
      return out
    })

    const records = parseFeeSchedule(normalisedRows)

    if (records.length === 0) {
      return NextResponse.json(
        { error: 'No valid fee schedule records found — check that the file has merchant_id, product_name, contracted_rate columns' },
        { status: 400 }
      )
    }

    const merchantCount = new Set(records.map((r) => r.merchant_id)).size
    const productCount = new Set(records.map((r) => r.product_name)).size

    const snapshotRows = records.map((record) =>
      Object.fromEntries(Object.entries(record).map(([key, value]) => [key, value == null ? '' : String(value)]))
    )
    const snapshot = await createSourceSnapshot({
      scope: { userId: userId ?? undefined, orgId: orgId ?? undefined },
      role: 'fee_schedule',
      name: file.name,
      filename: file.name,
      parsed: {
        headers: snapshotRows.length > 0 ? Object.keys(snapshotRows[0]) : [],
        rows: snapshotRows,
      },
      retentionDays: 1,
    })
    const fileId = snapshot?.id ?? uuidv4()
    storeFeeSchedule(fileId, { filename: file.name, records })

    await logAudit({
      action: 'fee_schedule_uploaded',
      userId: userId ?? undefined,
      orgId: orgId ?? undefined,
      ipAddress,
      metadata: {
        filename: file.name,
        size_bytes: file.size,
        merchant_count: merchantCount,
        product_count: productCount,
        record_count: records.length,
      },
    })

    return NextResponse.json(
      {
        fileId,
        filename: file.name,
        records,
        merchantCount,
        productCount,
      },
      { headers: rateLimitHeaders(rate) }
    )
  } catch (err) {
    console.error('[upload-fee-schedule]', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal server error' },
      { status: 500 }
    )
  }
}
