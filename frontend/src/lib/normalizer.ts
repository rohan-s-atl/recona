import { ColumnMapping, FileRole, NormalizedRecord } from '@/types'

const MONTH_NAMES: Record<string, string> = {
  january: '01', february: '02', march: '03', april: '04',
  may: '05', june: '06', july: '07', august: '08',
  september: '09', october: '10', november: '11', december: '12',
  jan: '01', feb: '02', mar: '03', apr: '04', jun: '06',
  jul: '07', aug: '08', sep: '09', oct: '10', nov: '11', dec: '12',
}

function normalizeDate(raw: string): string {
  const s = (raw ?? '').trim()
  if (!s) return ''

  // 2024-01-31 or 2024-01
  if (/^\d{4}-\d{2}(-\d{2})?$/.test(s)) return s.substring(0, 7)

  // 01/31/2024 or 01/2024
  const mdy = s.match(/^(\d{1,2})\/(\d{1,2}|(\d{4}))\/(\d{4})$/)
  if (mdy) return `${mdy[4]}-${mdy[1].padStart(2, '0')}`

  const my = s.match(/^(\d{1,2})\/(\d{4})$/)
  if (my) return `${my[2]}-${my[1].padStart(2, '0')}`

  // January 2024 / Jan 2024
  const monthYear = s.match(/^([A-Za-z]+)\s+(\d{4})$/)
  if (monthYear) {
    const month = MONTH_NAMES[monthYear[1].toLowerCase()]
    if (month) return `${monthYear[2]}-${month}`
  }

  // 02/01/2024 → treat as MM/DD/YYYY
  const mmddyyyy = s.match(/^(\d{2})\/(\d{2})\/(\d{4})$/)
  if (mmddyyyy) return `${mmddyyyy[3]}-${mmddyyyy[1]}`

  return s
}

function normalizeAmount(raw: string): number {
  if (!raw) return 0
  const cleaned = raw.replace(/[$,%\s]/g, '')
  const num = parseFloat(cleaned)
  return isNaN(num) ? 0 : Math.round(num * 100) / 100
}

function normalizeVolume(raw: string): number | null {
  if (!raw?.trim()) return null
  const cleaned = raw.replace(/[$,\s]/g, '')
  const num = parseFloat(cleaned)
  return isNaN(num) ? null : Math.round(num * 100) / 100
}

function normalizeName(raw: string): string {
  return (raw ?? '').trim().toLowerCase()
}

export function normalizeRecords(
  rows: Record<string, string>[],
  mapping: ColumnMapping,
  role: 'charges' | 'invoices'
): NormalizedRecord[] {
  return rows
    .filter((row) => {
      const values = Object.values(row).filter((v) => v != null && String(v).trim() !== '')
      return values.length > 0
    })
    .map((row, idx) => {
      const get = (col: string | null): string => {
        if (!col) return ''
        const val = row[col]
        if (val == null) return ''
        return String(val).trim()
      }

      const rawBillingPeriod = get(mapping.billing_period)
      const rawDate = get(mapping.date)
      const resolvedPeriod = normalizeDate(rawBillingPeriod || rawDate)
      const resolvedDate = normalizeDate(rawDate || rawBillingPeriod)

      return {
        _sourceRow: idx + 2,
        _fileRole: role,
        record_id: get(mapping.record_id) || `${role}-row-${idx + 2}`,
        client_id: get(mapping.client_id),
        client_name: normalizeName(get(mapping.client_name)),
        product_line: normalizeName(get(mapping.product_line)),
        product_name: normalizeName(get(mapping.product_name)),
        fee_type: normalizeName(get(mapping.fee_type)),
        amount: normalizeAmount(get(mapping.amount)),
        billing_period: resolvedPeriod,
        date: resolvedDate,
        transaction_volume: normalizeVolume(get(mapping.transaction_volume)),
        account_status: get(mapping.account_status),
        _raw: row,
      }
    })
}
