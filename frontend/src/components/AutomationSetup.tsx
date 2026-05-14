'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import type { ReconciliationCadence } from '@/types'

interface SnapshotOption {
  id: string
  role: string
  name: string
  filename: string
  row_count: number
  mapping: Record<string, string | null> | null
}

export function AutomationSetup({ snapshots }: { snapshots: SnapshotOption[] }) {
  const router = useRouter()
  const [name, setName] = useState('Monthly billing reconciliation')
  const [cadence, setCadence] = useState<ReconciliationCadence>('monthly')
  const [chargesSnapshotId, setChargesSnapshotId] = useState('')
  const [invoicesSnapshotId, setInvoicesSnapshotId] = useState('')
  const [feeScheduleSnapshotId, setFeeScheduleSnapshotId] = useState('')
  const [catchFastEnabled, setCatchFastEnabled] = useState(false)
  const [status, setStatus] = useState<string | null>(null)

  const charges = snapshots.find((snapshot) => snapshot.id === chargesSnapshotId)
  const invoices = snapshots.find((snapshot) => snapshot.id === invoicesSnapshotId)

  async function createSchedule() {
    setStatus(null)
    if (!charges?.mapping || !invoices?.mapping) {
      setStatus('Selected charges and invoices snapshots need saved mappings.')
      return
    }
    const response = await fetch('/api/schedules', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name,
        cadence,
        chargesSnapshotId,
        invoicesSnapshotId,
        feeScheduleSnapshotId: feeScheduleSnapshotId || null,
        chargesMapping: charges.mapping,
        invoicesMapping: invoices.mapping,
        catchFastEnabled,
      }),
    })
    const json = await response.json()
    setStatus(response.ok ? `Schedule created: ${json.name}` : json.error ?? 'Unable to create schedule')
    if (response.ok) router.refresh()
  }

  return (
    <div className="glass rounded-xl p-4">
      <p className="text-sm font-semibold text-gray-900">Create schedule</p>
      <div className="mt-4 grid gap-3 md:grid-cols-2">
        <label className="text-xs font-semibold text-gray-500">
          Name
          <input value={name} onChange={(event) => setName(event.target.value)} className="mt-1 w-full rounded-lg border border-white/70 bg-white/70 px-3 py-2 text-sm text-gray-900 outline-none" />
        </label>
        <label className="text-xs font-semibold text-gray-500">
          Cadence
          <select value={cadence} onChange={(event) => setCadence(event.target.value as ReconciliationCadence)} className="mt-1 w-full rounded-lg border border-white/70 bg-white/70 px-3 py-2 text-sm text-gray-900 outline-none">
            <option value="daily">Daily</option>
            <option value="weekly">Weekly</option>
            <option value="monthly">Monthly</option>
          </select>
        </label>
        <SnapshotSelect label="Charges snapshot" role="charges" value={chargesSnapshotId} snapshots={snapshots} onChange={setChargesSnapshotId} />
        <SnapshotSelect label="Invoices snapshot" role="invoices" value={invoicesSnapshotId} snapshots={snapshots} onChange={setInvoicesSnapshotId} />
        <SnapshotSelect label="Fee schedule" role="fee_schedule" value={feeScheduleSnapshotId} snapshots={snapshots} onChange={setFeeScheduleSnapshotId} optional />
      </div>
      <label className="mt-4 inline-flex items-center gap-2 text-sm font-medium text-gray-700">
        <input type="checkbox" checked={catchFastEnabled} onChange={(event) => setCatchFastEnabled(event.target.checked)} className="h-4 w-4 rounded border-gray-300" />
        Catch-it-fast mode, rolling 3-day comparison
      </label>
      <div className="mt-4 flex items-center gap-3">
        <button onClick={createSchedule} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white">Create schedule</button>
        {status && <p className="text-xs font-semibold text-gray-500">{status}</p>}
      </div>
    </div>
  )
}

function SnapshotSelect({
  label,
  role,
  value,
  snapshots,
  onChange,
  optional,
}: {
  label: string
  role: string
  value: string
  snapshots: SnapshotOption[]
  onChange: (value: string) => void
  optional?: boolean
}) {
  return (
    <label className="text-xs font-semibold text-gray-500">
      {label}
      <select value={value} onChange={(event) => onChange(event.target.value)} className="mt-1 w-full rounded-lg border border-white/70 bg-white/70 px-3 py-2 text-sm text-gray-900 outline-none">
        <option value="">{optional ? 'None' : 'Select snapshot'}</option>
        {snapshots.filter((snapshot) => snapshot.role === role).map((snapshot) => (
          <option key={snapshot.id} value={snapshot.id}>
            {snapshot.name} ({snapshot.row_count.toLocaleString()} rows)
          </option>
        ))}
      </select>
    </label>
  )
}
