import { NextRequest, NextResponse } from 'next/server'
import { getDataScope, hasRole } from '@/lib/auth'
import { createSourceSnapshot, getSourceSnapshots } from '@/lib/db'
import { parseFile } from '@/lib/fileParser'
import {
  isSupportedFileExtension,
  MAX_UPLOAD_BYTES,
  MAX_UPLOAD_LABEL,
  SUPPORTED_FILE_TYPES_LABEL,
} from '@/lib/uploadConfig'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
const MAX_SNAPSHOT_ROWS = Number(process.env.MAX_SOURCE_SNAPSHOT_ROWS ?? 100000)

export async function GET() {
  if (!(await hasRole('viewer'))) {
    return NextResponse.json({ error: 'Viewer access required' }, { status: 403 })
  }

  const snapshots = await getSourceSnapshots(getDataScope())
  return NextResponse.json({ snapshots })
}

export async function POST(request: NextRequest) {
  if (!(await hasRole('analyst'))) {
    return NextResponse.json({ error: 'Analyst access required' }, { status: 403 })
  }

  const form = await request.formData()
  const file = form.get('file')
  const role = form.get('role')
  const name = String(form.get('name') ?? '')
  const mappingText = form.get('mapping')
  if (!(file instanceof File)) return NextResponse.json({ error: 'file is required' }, { status: 400 })
  if (!isSupportedFileExtension(file.name)) {
    return NextResponse.json({ error: `Unsupported file type. Upload ${SUPPORTED_FILE_TYPES_LABEL}.` }, { status: 400 })
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    return NextResponse.json({ error: `File too large (max ${MAX_UPLOAD_LABEL})` }, { status: 400 })
  }
  if (role !== 'charges' && role !== 'invoices' && role !== 'fee_schedule') {
    return NextResponse.json({ error: 'role must be charges, invoices, or fee_schedule' }, { status: 400 })
  }
  const mapping = parseMapping(mappingText)
  if (mapping instanceof Error) return NextResponse.json({ error: mapping.message }, { status: 400 })
  const parsed = await parseFile(file)
  if (parsed.rows.length === 0) {
    return NextResponse.json({ error: 'File appears to be empty' }, { status: 400 })
  }
  if (parsed.rows.length > MAX_SNAPSHOT_ROWS) {
    return NextResponse.json(
      { error: `Snapshot has ${parsed.rows.length.toLocaleString()} rows; max is ${MAX_SNAPSHOT_ROWS.toLocaleString()}` },
      { status: 413 }
    )
  }
  if ((role === 'charges' || role === 'invoices') && !mapping) {
    return NextResponse.json({ error: 'Charges and invoices snapshots require a saved column mapping' }, { status: 400 })
  }
  const snapshot = await createSourceSnapshot({
    scope: getDataScope(),
    role,
    name: name || file.name,
    filename: file.name,
    parsed,
    mapping,
    retentionDays: 90,
  })
  if (!snapshot) return NextResponse.json({ error: 'Unable to store snapshot' }, { status: 500 })
  return NextResponse.json(snapshot)
}

function parseMapping(mappingText: FormDataEntryValue | null): Record<string, string | null> | null | Error {
  if (typeof mappingText !== 'string' || !mappingText.trim()) return null
  try {
    const parsed = JSON.parse(mappingText) as unknown
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return new Error('mapping must be a JSON object')
    }
    for (const value of Object.values(parsed as Record<string, unknown>)) {
      if (value !== null && typeof value !== 'string') return new Error('mapping values must be strings or null')
    }
    return parsed as Record<string, string | null>
  } catch {
    return new Error('mapping must be valid JSON')
  }
}
