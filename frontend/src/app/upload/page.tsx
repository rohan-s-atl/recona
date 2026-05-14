'use client'

import { useState } from 'react'
import { FileDropzone } from '@/components/FileDropzone'
import { DataPreview } from '@/components/DataPreview'
import { ColumnMapper } from '@/components/ColumnMapper'
import { RunResultView } from '@/components/RunResultView'
import {
  ColumnMapping,
  FeeScheduleUploadResponse,
  ReconciliationResult,
  UploadApiResponse,
} from '@/types'
import {
  CheckCircle,
  ChevronRight,
  Loader2,
  AlertCircle,
  FileSpreadsheet,
  X,
} from 'lucide-react'
import { cn, formatBytes } from '@/lib/utils'

type Step = 'upload' | 'mapping' | 'running' | 'results'
type ReconcilePhase = 'parsing' | 'exact_match' | 'fuzzy_match' | 'rate_check' | 'summary' | 'saving'

interface QueuedStatus {
  jobId: string
  state: 'waiting' | 'active' | 'completed' | 'failed' | 'delayed' | string
  progress?: unknown
  failedReason?: string
  returnvalue?: ReconciliationResult
}

interface ProgressState {
  phase: ReconcilePhase
  label: string
  detail?: string
}

const PHASE_LIST: ReconcilePhase[] = ['parsing', 'exact_match', 'fuzzy_match', 'rate_check', 'summary', 'saving']
const PHASE_ORDER: Record<ReconcilePhase, number> = {
  parsing: 0, exact_match: 1, fuzzy_match: 2, rate_check: 3, summary: 4, saving: 5,
}
const PHASE_LABELS: Record<ReconcilePhase, string> = {
  parsing: 'Loading files',
  exact_match: 'Exact match',
  fuzzy_match: 'AI fuzzy matching',
  rate_check: 'Rate & plan check',
  summary: 'Executive summary',
  saving: 'Saving results',
}

const QUEUE_ROW_THRESHOLD = 5000

function queuedStatusUrl(jobId: string): string {
  return `/api/runs/${jobId}/status`
}

interface FileState {
  file: File | null
  response: UploadApiResponse | null
  mapping: ColumnMapping | null
  loading: boolean
  error: string | null
}

const emptyFile = (): FileState => ({
  file: null,
  response: null,
  mapping: null,
  loading: false,
  error: null,
})

const STEPS: { id: Step; label: string }[] = [
  { id: 'upload', label: 'Upload files' },
  { id: 'mapping', label: 'Confirm columns' },
  { id: 'running', label: 'Reconcile' },
  { id: 'results', label: 'Results' },
]

export default function UploadPage() {
  const [step, setStep] = useState<Step>('upload')
  const [charges, setCharges] = useState<FileState>(emptyFile())
  const [invoices, setInvoices] = useState<FileState>(emptyFile())
  const [feeSchedule, setFeeSchedule] = useState<{
    file: File | null
    response: FeeScheduleUploadResponse | null
    loading: boolean
    error: string | null
  }>({ file: null, response: null, loading: false, error: null })
  const [result, setResult] = useState<ReconciliationResult | null>(null)
  const [runError, setRunError] = useState<string | null>(null)
  const [isRunning, setIsRunning] = useState(false)
  const [progress, setProgress] = useState<ProgressState | null>(null)

  // ── File upload handlers ───────────────────────────────────────────────────

  async function handleFile(role: 'charges' | 'invoices', file: File | null) {
    const setter = role === 'charges' ? setCharges : setInvoices
    if (!file) { setter(emptyFile()); return }

    setter((p) => ({ ...p, file, loading: true, error: null }))
    try {
      const fd = new FormData()
      fd.append('file', file)
      fd.append('role', role)
      const res = await fetch('/api/upload', { method: 'POST', body: fd })
      if (!res.ok) throw new Error((await res.json()).error ?? 'Upload failed')
      const data: UploadApiResponse = await res.json()
      setter((p) => ({ ...p, response: data, mapping: data.suggestedMapping, loading: false }))
    } catch (err) {
      setter((p) => ({
        ...p,
        loading: false,
        error: err instanceof Error ? err.message : 'Upload failed',
      }))
    }
  }

  async function handleFeeSchedule(file: File | null) {
    if (!file) { setFeeSchedule({ file: null, response: null, loading: false, error: null }); return }

    setFeeSchedule((p) => ({ ...p, file, loading: true, error: null }))
    try {
      const fd = new FormData()
      fd.append('file', file)
      const res = await fetch('/api/upload-fee-schedule', { method: 'POST', body: fd })
      if (!res.ok) throw new Error((await res.json()).error ?? 'Upload failed')
      const data: FeeScheduleUploadResponse = await res.json()
      setFeeSchedule((p) => ({ ...p, response: data, loading: false }))
    } catch (err) {
      setFeeSchedule((p) => ({
        ...p,
        loading: false,
        error: err instanceof Error ? err.message : 'Upload failed',
      }))
    }
  }

  // ── Reconcile (SSE streaming) ──────────────────────────────────────────────

  async function runReconciliation() {
    if (!charges.response || !invoices.response || !charges.mapping || !invoices.mapping) return
    setIsRunning(true)
    setRunError(null)
    setProgress(null)
    setStep('running')

    try {
      const res = await fetch('/api/reconcile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chargesFileId: charges.response.fileId,
          invoicesFileId: invoices.response.fileId,
          chargesMapping: charges.mapping,
          invoicesMapping: invoices.mapping,
          feeScheduleFileId: feeSchedule.response?.fileId,
        }),
      })

      if (!res.ok || !res.body) {
        const json = await res.json().catch(() => ({}))
        throw new Error(json.error ?? 'Reconciliation failed')
      }

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const parts = buffer.split('\n\n')
        buffer = parts.pop() ?? ''

        for (const part of parts) {
          const eventLine = part.split('\n').find((l) => l.startsWith('event: '))
          const dataLine = part.split('\n').find((l) => l.startsWith('data: '))
          if (!eventLine || !dataLine) continue

          const eventName = eventLine.slice(7).trim()
          const eventData = JSON.parse(dataLine.slice(6))

          if (eventName === 'progress') {
            setProgress(eventData as ProgressState)
          } else if (eventName === 'complete') {
            setResult(eventData as ReconciliationResult)
            setStep('results')
          } else if (eventName === 'error') {
            throw new Error(eventData.message ?? 'Reconciliation failed')
          }
        }
      }
    } catch (err) {
      setRunError(err instanceof Error ? err.message : 'Reconciliation failed')
      setStep('mapping')
    } finally {
      setIsRunning(false)
    }
  }

  async function runQueuedReconciliation() {
    if (!charges.response || !invoices.response || !charges.mapping || !invoices.mapping) return
    setIsRunning(true)
    setRunError(null)
    setResult(null)
    setProgress({ phase: 'parsing', label: 'Queueing reconciliation...', detail: 'Sending job to worker' })
    setStep('running')

    try {
      const enqueue = await fetch('/api/reconcile/queued', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chargesFileId: charges.response.fileId,
          invoicesFileId: invoices.response.fileId,
          chargesMapping: charges.mapping,
          invoicesMapping: invoices.mapping,
          feeScheduleFileId: feeSchedule.response?.fileId,
        }),
      })
      const queued = await enqueue.json()
      if (!enqueue.ok) throw new Error(queued.error ?? 'Failed to queue reconciliation')

      const jobId = queued.jobId as string
      setProgress({ phase: 'parsing', label: 'Queued in background', detail: `Job ${jobId}` })

      while (true) {
        await new Promise((resolve) => setTimeout(resolve, 1500))
        const statusRes = await fetch(queuedStatusUrl(jobId), { cache: 'no-store' })
        const status = (await statusRes.json()) as QueuedStatus & { error?: string }
        if (!statusRes.ok) throw new Error(status.error ?? 'Failed to read job status')

        if (status.state === 'completed' && status.returnvalue) {
          setProgress({ phase: 'saving', label: 'Loading completed result...', detail: `Job ${jobId}` })
          setResult(status.returnvalue)
          setStep('results')
          break
        }

        if (status.state === 'failed') {
          throw new Error(status.failedReason ?? 'Background reconciliation failed')
        }

        setProgress({
          phase: status.state === 'active' ? 'summary' : 'parsing',
          label: status.state === 'active' ? 'Worker is processing...' : 'Waiting for worker...',
          detail: `Job ${jobId} - ${status.state}`,
        })
      }
    } catch (err) {
      setRunError(err instanceof Error ? err.message : 'Queued reconciliation failed')
      setStep('mapping')
    } finally {
      setIsRunning(false)
    }
  }

  function reset() {
    setStep('upload')
    setCharges(emptyFile())
    setInvoices(emptyFile())
    setFeeSchedule({ file: null, response: null, loading: false, error: null })
    setResult(null)
    setRunError(null)
    setProgress(null)
  }

  const currentStepIdx = STEPS.findIndex((s) => s.id === step)
  const canProceed = !!charges.response && !!invoices.response && !charges.loading && !invoices.loading
  const totalUploadedRows = (charges.response?.rowsCount ?? charges.response?.sample.length ?? 0) +
    (invoices.response?.rowsCount ?? invoices.response?.sample.length ?? 0)
  const shouldPreferQueue = totalUploadedRows >= QUEUE_ROW_THRESHOLD

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <main className="mx-auto max-w-[1800px] px-6 py-7 lg:px-10">
      {/* Step indicator */}
      <div className="flex items-center gap-2 mb-8 flex-wrap">
        {STEPS.map((s, i) => (
          <div key={s.id} className="flex items-center gap-2">
            <div
              className={cn(
                'flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full transition-all',
                i < currentStepIdx
                  ? 'bg-emerald-500/10 text-emerald-700'
                  : i === currentStepIdx
                  ? 'bg-blue-600 text-white shadow-sm shadow-blue-500/25'
                  : 'bg-white/50 text-gray-400 border border-white/60'
              )}
            >
              {i < currentStepIdx && <CheckCircle className="w-3 h-3" />}
              {s.label}
            </div>
            {i < STEPS.length - 1 && <ChevronRight className="w-3.5 h-3.5 text-gray-300" />}
          </div>
        ))}
      </div>

      {/* ── Step 1: Upload ── */}
      {step === 'upload' && (
        <div className="space-y-8">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Upload your billing files</h1>
            <p className="text-gray-500 mt-1">
              Upload your product charges and billing invoices. Optionally add a fee schedule to
              enable rate and plan mismatch detection.
            </p>
          </div>

          {/* Required files */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {[
              { role: 'charges' as const, state: charges, label: 'Product Charges File', desc: 'Export from account management or CRM' },
              { role: 'invoices' as const, state: invoices, label: 'Billing Invoices File', desc: 'Export from billing engine or ERP' },
            ].map(({ role, state, label, desc }) => (
              <div key={role} className="space-y-4">
                <FileDropzone
                  role={role}
                  label={label}
                  description={desc}
                  onFile={(f) => handleFile(role, f)}
                  selectedFile={state.file}
                  isLoading={state.loading}
                />
                {state.error && (
                  <p className="text-sm text-red-500 flex items-center gap-1">
                    <AlertCircle className="w-4 h-4" /> {state.error}
                  </p>
                )}
                {state.response && (
                  <DataPreview
                    headers={state.response.headers}
                    rows={state.response.sample}
                    title={role === 'charges' ? 'Charges preview' : 'Invoices preview'}
                  />
                )}
              </div>
            ))}
          </div>

          {/* Optional fee schedule */}
          <div className="glass border-dashed rounded-2xl p-6 space-y-4">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm font-semibold text-gray-700">
                  Fee Schedule / Contract Rates{' '}
                  <span className="text-xs font-normal text-gray-400 ml-1">optional</span>
                </p>
                <p className="text-xs text-gray-500 mt-0.5">
                  Upload your merchant contract rate table to detect rate mismatches, plan
                  mismatches, and fees that should be billed but are not. This is where the real
                  revenue recovery lives.
                </p>
              </div>
              {feeSchedule.response && (
                <div className="text-right text-xs text-emerald-600 font-semibold">
                  <CheckCircle className="w-4 h-4 inline mr-1" />
                  {feeSchedule.response.merchantCount} merchants - {feeSchedule.response.productCount} products loaded
                </div>
              )}
            </div>

            {feeSchedule.file ? (
              <div className="flex items-center gap-3 bg-white/60 rounded-xl border border-emerald-300/50 p-3 backdrop-blur-sm">
                <FileSpreadsheet className="w-6 h-6 text-emerald-600 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">{feeSchedule.file.name}</p>
                  <p className="text-xs text-gray-400">{formatBytes(feeSchedule.file.size)}</p>
                </div>
                {feeSchedule.loading && <Loader2 className="w-4 h-4 animate-spin text-gray-400" />}
                {!feeSchedule.loading && (
                  <button
                    onClick={() => handleFeeSchedule(null)}
                    className="p-1 text-gray-400 hover:text-gray-600"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>
            ) : (
              <label className="flex items-center gap-3 cursor-pointer bg-white/50 rounded-xl border border-white/70 p-3 hover:bg-white/70 transition-colors backdrop-blur-sm">
                <FileSpreadsheet className="w-6 h-6 text-gray-400" />
                <span className="text-sm text-gray-500">
                  Drop fee schedule CSV or{' '}
                  <span className="text-blue-600 font-medium">browse</span>
                </span>
                <input
                  type="file"
                  accept=".csv,.tsv,.xlsx,.xls,.ods,.json"
                  className="hidden"
                  onChange={(e) => handleFeeSchedule(e.target.files?.[0] ?? null)}
                />
              </label>
            )}
            {feeSchedule.error && (
              <p className="text-sm text-red-500 flex items-center gap-1">
                <AlertCircle className="w-4 h-4" /> {feeSchedule.error}
              </p>
            )}
          </div>

          <div className="flex justify-end">
            <button
              disabled={!canProceed}
              onClick={() => setStep('mapping')}
              className={cn(
                'px-6 py-3 rounded-xl font-semibold text-sm transition-colors',
                canProceed
                  ? 'bg-blue-600 text-white hover:bg-blue-700 shadow-md shadow-blue-500/20'
                  : 'bg-white/40 text-gray-400 cursor-not-allowed border border-white/60'
              )}
            >
              Review column mapping
            </button>
          </div>
        </div>
      )}

      {/* ── Step 2: Mapping ── */}
      {step === 'mapping' && charges.response && invoices.response && (
        <div className="space-y-8">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Confirm column mapping</h1>
            <p className="text-gray-500 mt-1">
              Claude mapped your columns automatically. Adjust if anything looks off.
            </p>
          </div>
          {runError && (
            <div className="bg-red-500/10 border border-red-300/40 rounded-xl p-4 text-sm text-red-700 flex gap-2 backdrop-blur-sm">
              <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" /> {runError}
            </div>
          )}
          <div className="space-y-6">
            <ColumnMapper
              role="charges"
              headers={charges.response.headers}
              mapping={charges.mapping!}
              onChange={(m) => setCharges((p) => ({ ...p, mapping: m }))}
            />
            <ColumnMapper
              role="invoices"
              headers={invoices.response.headers}
              mapping={invoices.mapping!}
              onChange={(m) => setInvoices((p) => ({ ...p, mapping: m }))}
            />
          </div>
          <div className="flex items-center justify-between">
            <button onClick={() => setStep('upload')} className="text-sm font-semibold text-gray-500 hover:text-gray-800">
              Back
            </button>
            <div className="flex items-center gap-3">
              <button
                onClick={runQueuedReconciliation}
                disabled={isRunning}
                className="flex items-center gap-2 px-5 py-3 rounded-xl font-semibold text-sm glass text-gray-700 hover:bg-white/70 transition-colors disabled:opacity-60"
              >
                {isRunning && <Loader2 className="w-4 h-4 animate-spin" />}
                {shouldPreferQueue ? 'Run in background (recommended)' : 'Run in background'}
              </button>
              <button
                onClick={shouldPreferQueue ? runQueuedReconciliation : runReconciliation}
                disabled={isRunning}
                className="flex items-center gap-2 px-6 py-3 rounded-xl font-semibold text-sm bg-blue-600 text-white hover:bg-blue-700 transition-colors disabled:opacity-60"
              >
                {isRunning && <Loader2 className="w-4 h-4 animate-spin" />}
                {shouldPreferQueue ? 'Run queued' : 'Run reconciliation'}
                {feeSchedule.response && (
                  <span className="text-blue-200 text-xs font-normal">+ rate check</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Step 3: Running ── */}
      {step === 'running' && (
        <div className="flex flex-col items-center justify-center py-20 space-y-10">
          <div className="text-center">
            <h2 className="text-xl font-bold text-gray-900">Running reconciliation...</h2>
            <p className="text-gray-400 mt-1.5 text-sm">
              {progress?.label ?? 'Initializing...'}
            </p>
          </div>

          <div className="glass rounded-2xl p-8 w-full max-w-xs space-y-5">
            {PHASE_LIST.map((phase) => {
              const phaseOrder = PHASE_ORDER[phase]
              const currentOrder = progress ? PHASE_ORDER[progress.phase] : -1
              const isDone = phaseOrder < currentOrder
              const isActive = phaseOrder === currentOrder

              return (
                <div key={phase} className="flex items-start gap-3">
                  <div className="mt-0.5 flex-shrink-0">
                    {isDone ? (
                      <CheckCircle className="w-4 h-4 text-emerald-500" />
                    ) : isActive ? (
                      <Loader2 className="w-4 h-4 text-blue-600 animate-spin" />
                    ) : (
                      <div className="w-4 h-4 rounded-full border-2 border-gray-200" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={cn(
                      'text-sm font-medium leading-tight',
                      isDone ? 'text-gray-400' : isActive ? 'text-gray-900' : 'text-gray-300'
                    )}>
                      {PHASE_LABELS[phase]}
                    </p>
                    {isActive && progress?.detail && (
                      <p className="text-xs text-gray-400 mt-0.5">{progress.detail}</p>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* ── Step 4: Results ── */}
      {step === 'results' && result && (
        <div className="space-y-8">
          <div className="flex flex-wrap items-start justify-between gap-4 print:hidden">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Reconciliation complete</h1>
              <p className="mt-1 text-sm text-gray-500">
                Review the summary, assign exceptions, then approve fixes from the resolutions desk.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              {result.persisted && (
                <a
                  href={`/runs/${result.runId}`}
                  target="_blank"
                  rel="noreferrer"
                  className="text-sm font-semibold text-gray-600 glass px-3 py-2 rounded-lg hover:bg-white/70 transition-colors"
                >
                  Permanent link
                </a>
              )}
              <button onClick={reset} className="text-sm font-semibold text-blue-600 hover:text-blue-700">
                New run
              </button>
            </div>
          </div>
          <RunResultView
            result={result}
            ranAt={result.ranAt}
            chargesFilename={charges.response?.filename ?? charges.file?.name ?? 'Charges file'}
            invoicesFilename={invoices.response?.filename ?? invoices.file?.name ?? 'Invoices file'}
          />
        </div>
      )}
    </main>
  )
}
