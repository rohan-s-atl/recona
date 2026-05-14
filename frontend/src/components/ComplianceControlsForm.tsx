'use client'

import { useState } from 'react'

export function ComplianceControlsForm({
  initial,
}: {
  initial: {
    retention_days: number
    auto_delete_enabled: boolean
    evidence_collection_enabled: boolean
    data_processing_region: string
    soc2_process_started_at: string | null
  }
}) {
  const [retentionDays, setRetentionDays] = useState(initial.retention_days)
  const [autoDeleteEnabled, setAutoDeleteEnabled] = useState(initial.auto_delete_enabled)
  const [evidenceCollectionEnabled, setEvidenceCollectionEnabled] = useState(initial.evidence_collection_enabled)
  const [dataProcessingRegion, setDataProcessingRegion] = useState(initial.data_processing_region)
  const [status, setStatus] = useState<string | null>(null)

  async function save() {
    const response = await fetch('/api/compliance/controls', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ retentionDays, autoDeleteEnabled, evidenceCollectionEnabled, dataProcessingRegion }),
    })
    const json = await response.json()
    setStatus(response.ok ? 'Compliance controls saved' : json.error ?? 'Unable to save')
  }

  async function collect() {
    const response = await fetch('/api/compliance/controls', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'collect_evidence' }),
    })
    const json = await response.json()
    setStatus(response.ok ? `Collected ${json.collected} evidence records` : json.error ?? 'Unable to collect evidence')
  }

  async function enforceRetention() {
    const response = await fetch('/api/compliance/controls', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'enforce_retention' }),
    })
    const json = await response.json()
    setStatus(
      response.ok
        ? `Deleted ${json.snapshotsDeleted} snapshots and revoked ${json.shareLinksRevoked} expired share links`
        : json.error ?? 'Unable to enforce retention'
    )
  }

  return (
    <div className="glass rounded-xl p-4">
      <p className="text-sm font-semibold text-gray-900">Compliance controls</p>
      <div className="mt-4 grid gap-3 md:grid-cols-2">
        <label className="text-xs font-semibold text-gray-500">
          Retention days
          <input type="number" value={retentionDays} onChange={(event) => setRetentionDays(Number(event.target.value))} className="mt-1 w-full rounded-lg border border-white/70 bg-white/70 px-3 py-2 text-sm text-gray-900 outline-none" />
        </label>
        <label className="text-xs font-semibold text-gray-500">
          Data region
          <input value={dataProcessingRegion} onChange={(event) => setDataProcessingRegion(event.target.value)} className="mt-1 w-full rounded-lg border border-white/70 bg-white/70 px-3 py-2 text-sm text-gray-900 outline-none" />
        </label>
      </div>
      <div className="mt-4 flex flex-wrap gap-4 text-sm font-medium text-gray-700">
        <label className="inline-flex items-center gap-2">
          <input type="checkbox" checked={autoDeleteEnabled} onChange={(event) => setAutoDeleteEnabled(event.target.checked)} className="h-4 w-4 rounded border-gray-300" />
          Auto-delete expired source snapshots
        </label>
        <label className="inline-flex items-center gap-2">
          <input type="checkbox" checked={evidenceCollectionEnabled} onChange={(event) => setEvidenceCollectionEnabled(event.target.checked)} className="h-4 w-4 rounded border-gray-300" />
          Evidence collection
        </label>
      </div>
      <div className="mt-5 flex items-center gap-3">
        <button onClick={save} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white">Save</button>
        <button onClick={collect} className="rounded-lg bg-white/70 px-4 py-2 text-sm font-semibold text-gray-700">Collect evidence</button>
        <button onClick={enforceRetention} className="rounded-lg bg-white/70 px-4 py-2 text-sm font-semibold text-gray-700">Enforce retention</button>
        {status && <p className="text-xs font-semibold text-gray-500">{status}</p>}
      </div>
    </div>
  )
}
