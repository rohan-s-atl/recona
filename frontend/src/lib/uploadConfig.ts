export const SUPPORTED_FILE_EXTENSIONS = ['csv', 'tsv', 'xlsx', 'xls', 'ods', 'json'] as const

export const FILE_ACCEPT = '.csv,.tsv,.xlsx,.xls,.ods,.json'
export const SUPPORTED_FILE_TYPES_LABEL = 'CSV, TSV, Excel, ODS, or JSON'
export const MAX_UPLOAD_BYTES = 50 * 1024 * 1024
export const MAX_UPLOAD_LABEL = '50 MB'

export function isSupportedFileExtension(filename: string): boolean {
  const ext = filename.split('.').pop()?.toLowerCase()
  return SUPPORTED_FILE_EXTENSIONS.includes(ext as (typeof SUPPORTED_FILE_EXTENSIONS)[number])
}
