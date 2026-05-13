import Papa from 'papaparse'
import * as XLSX from 'xlsx'
import { SUPPORTED_FILE_EXTENSIONS } from './uploadConfig'

export interface ParsedFile {
  headers: string[]
  rows: Record<string, string>[]
}

export async function parseFile(file: File): Promise<ParsedFile> {
  const ext = file.name.split('.').pop()?.toLowerCase()

  if (ext === 'csv') return parseCsvFile(file, ',')
  if (ext === 'tsv') return parseCsvFile(file, '\t')
  if (ext === 'xlsx' || ext === 'xls' || ext === 'ods') return parseExcelFile(file)
  if (ext === 'json') return parseJsonFile(file)

  throw new Error(`Unsupported file type: .${ext}. Supported: ${SUPPORTED_FILE_EXTENSIONS.join(', ')}`)
}

function parseCsvFile(file: File, delimiter: string): Promise<ParsedFile> {
  return new Promise((resolve, reject) => {
    Papa.parse(file, {
      header: true,
      delimiter,
      skipEmptyLines: true,
      transformHeader: (h) => h.trim(),
      transform: (v) => v.trim(),
      complete: (results) => {
        const headers = results.meta.fields ?? []
        const rows = results.data as Record<string, string>[]
        resolve({ headers, rows })
      },
      error: reject,
    })
  })
}

async function parseExcelFile(file: File): Promise<ParsedFile> {
  const buffer = await file.arrayBuffer()
  const workbook = XLSX.read(buffer, { type: 'array' })
  const sheet = workbook.Sheets[workbook.SheetNames[0]]
  const raw: Record<string, string>[] = XLSX.utils.sheet_to_json(sheet, {
    raw: false,
    defval: '',
  })
  const headers = raw.length > 0 ? Object.keys(raw[0]) : []
  return { headers, rows: raw }
}

async function parseJsonFile(file: File): Promise<ParsedFile> {
  const text = await file.text()
  const data = JSON.parse(text)
  if (!Array.isArray(data) || data.length === 0) {
    throw new Error('JSON file must be a non-empty array of objects')
  }
  const headers = Object.keys(data[0])
  const rows = data.map((item: Record<string, unknown>) =>
    Object.fromEntries(headers.map((h) => [h, item[h] == null ? '' : String(item[h])]))
  )
  return { headers, rows }
}

export function parseFileFromBuffer(buffer: Buffer, filename: string): ParsedFile {
  const ext = filename.split('.').pop()?.toLowerCase()

  if (ext === 'csv') return parseCsvBuffer(buffer, ',')
  if (ext === 'tsv') return parseCsvBuffer(buffer, '\t')
  if (ext === 'xlsx' || ext === 'xls' || ext === 'ods') return parseExcelBuffer(buffer)
  if (ext === 'json') return parseJsonBuffer(buffer)

  throw new Error(`Unsupported file type: ${filename}. Supported: ${SUPPORTED_FILE_EXTENSIONS.join(', ')}`)
}

function parseCsvBuffer(buffer: Buffer, delimiter: string): ParsedFile {
  const text = buffer.toString('utf-8')
  const result = Papa.parse(text, {
    header: true,
    delimiter,
    skipEmptyLines: true,
    transformHeader: (h) => h.trim(),
    transform: (v) => v.trim(),
  })
  return {
    headers: result.meta.fields ?? [],
    rows: result.data as Record<string, string>[],
  }
}

function parseExcelBuffer(buffer: Buffer): ParsedFile {
  const workbook = XLSX.read(buffer, { type: 'buffer' })
  const sheet = workbook.Sheets[workbook.SheetNames[0]]
  const raw: Record<string, string>[] = XLSX.utils.sheet_to_json(sheet, {
    raw: false,
    defval: '',
  })
  return {
    headers: raw.length > 0 ? Object.keys(raw[0]) : [],
    rows: raw,
  }
}

function parseJsonBuffer(buffer: Buffer): ParsedFile {
  const data = JSON.parse(buffer.toString('utf-8'))
  if (!Array.isArray(data) || data.length === 0) {
    throw new Error('JSON file must be a non-empty array of objects')
  }
  const headers = Object.keys(data[0])
  const rows = data.map((item: Record<string, unknown>) =>
    Object.fromEntries(headers.map((h) => [h, item[h] == null ? '' : String(item[h])]))
  )
  return { headers, rows }
}
