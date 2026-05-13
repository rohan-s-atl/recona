import { FeeScheduleRecord } from '@/types'
import { ParsedFile } from './fileParser'

interface StoredFile {
  filename: string
  sizeBytes: number
  parsed: ParsedFile
  storedAt: number
}

interface StoredFeeSchedule {
  filename: string
  records: FeeScheduleRecord[]
  storedAt: number
}

declare global {
  // eslint-disable-next-line no-var
  var __fileStore: Map<string, StoredFile> | undefined
  // eslint-disable-next-line no-var
  var __feeScheduleStore: Map<string, StoredFeeSchedule> | undefined
}

function getFileStore(): Map<string, StoredFile> {
  if (!global.__fileStore) global.__fileStore = new Map()
  return global.__fileStore
}

function getFeeScheduleStore(): Map<string, StoredFeeSchedule> {
  if (!global.__feeScheduleStore) global.__feeScheduleStore = new Map()
  return global.__feeScheduleStore
}

const TTL_MS = 2 * 60 * 60 * 1000

function evict<T extends { storedAt: number }>(store: Map<string, T>): void {
  const cutoff = Date.now() - TTL_MS
  Array.from(store.entries()).forEach(([id, entry]) => {
    if (entry.storedAt < cutoff) store.delete(id)
  })
}

export function storeFile(fileId: string, data: Omit<StoredFile, 'storedAt'>): void {
  const store = getFileStore()
  store.set(fileId, { ...data, storedAt: Date.now() })
  evict(store)
}

export function getFile(fileId: string): StoredFile | undefined {
  return getFileStore().get(fileId)
}

export function storeFeeSchedule(
  fileId: string,
  data: Omit<StoredFeeSchedule, 'storedAt'>
): void {
  const store = getFeeScheduleStore()
  store.set(fileId, { ...data, storedAt: Date.now() })
  evict(store)
}

export function getFeeSchedule(fileId: string): StoredFeeSchedule | undefined {
  return getFeeScheduleStore().get(fileId)
}
