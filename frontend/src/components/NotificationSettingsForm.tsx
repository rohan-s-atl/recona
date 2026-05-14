'use client'

import { useState } from 'react'

interface NotificationSettingsFormProps {
  initial: {
    alert_threshold_cents: number
    slack_webhook_url: string | null
    slack_channel: string | null
    weekly_digest_enabled: boolean
    email_alerts_enabled: boolean
    slack_alerts_enabled: boolean
  }
}

export function NotificationSettingsForm({ initial }: NotificationSettingsFormProps) {
  const [threshold, setThreshold] = useState((initial.alert_threshold_cents / 100).toString())
  const [slackWebhookUrl, setSlackWebhookUrl] = useState(initial.slack_webhook_url ?? '')
  const [slackChannel, setSlackChannel] = useState(initial.slack_channel ?? '')
  const [weeklyDigestEnabled, setWeeklyDigestEnabled] = useState(initial.weekly_digest_enabled)
  const [emailAlertsEnabled, setEmailAlertsEnabled] = useState(initial.email_alerts_enabled)
  const [slackAlertsEnabled, setSlackAlertsEnabled] = useState(initial.slack_alerts_enabled)
  const [status, setStatus] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function save() {
    setBusy(true)
    setStatus(null)
    try {
      const response = await fetch('/api/settings/notifications', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          alertThresholdDollars: Number(threshold),
          slackWebhookUrl: slackWebhookUrl || null,
          slackChannel: slackChannel || null,
          weeklyDigestEnabled,
          emailAlertsEnabled,
          slackAlertsEnabled,
        }),
      })
      const json = await response.json()
      if (!response.ok) throw new Error(json.error ?? 'Unable to save settings')
      setStatus('Saved notification settings')
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Unable to save settings')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="glass rounded-2xl p-5">
      <p className="text-sm font-semibold text-gray-800">Notification rules</p>
      <p className="mt-1 text-xs text-gray-400">
        Configure Phase 2 alerts for run completion, large discrepancies, assignments, overdue items, and digests.
      </p>
      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <label className="text-xs font-semibold text-gray-500">
          Alert threshold ($)
          <input
            value={threshold}
            onChange={(event) => setThreshold(event.target.value)}
            type="number"
            min="0"
            className="mt-1 w-full rounded-lg border border-white/70 bg-white/70 px-3 py-2 text-sm font-medium text-gray-800 outline-none"
          />
        </label>
        <label className="text-xs font-semibold text-gray-500">
          Slack channel
          <input
            value={slackChannel}
            onChange={(event) => setSlackChannel(event.target.value)}
            placeholder="#billing-alerts"
            className="mt-1 w-full rounded-lg border border-white/70 bg-white/70 px-3 py-2 text-sm font-medium text-gray-800 outline-none"
          />
        </label>
        <label className="md:col-span-2 text-xs font-semibold text-gray-500">
          Slack webhook URL
          <input
            value={slackWebhookUrl}
            onChange={(event) => setSlackWebhookUrl(event.target.value)}
            placeholder="https://hooks.slack.com/services/..."
            className="mt-1 w-full rounded-lg border border-white/70 bg-white/70 px-3 py-2 text-sm font-medium text-gray-800 outline-none"
          />
        </label>
      </div>
      <div className="mt-4 flex flex-wrap gap-4 text-sm font-medium text-gray-700">
        {[
          ['Email alerts', emailAlertsEnabled, setEmailAlertsEnabled],
          ['Slack alerts', slackAlertsEnabled, setSlackAlertsEnabled],
          ['Weekly digest', weeklyDigestEnabled, setWeeklyDigestEnabled],
        ].map(([label, checked, setter]) => (
          <label key={label as string} className="inline-flex items-center gap-2">
            <input
              type="checkbox"
              checked={checked as boolean}
              onChange={(event) => (setter as (value: boolean) => void)(event.target.checked)}
              className="h-4 w-4 rounded border-gray-300"
            />
            {label as string}
          </label>
        ))}
      </div>
      <div className="mt-5 flex items-center gap-3">
        <button
          onClick={save}
          disabled={busy}
          className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm shadow-blue-500/20 disabled:opacity-40"
        >
          Save notifications
        </button>
        {status && <p className="text-xs font-semibold text-gray-500">{status}</p>}
      </div>
    </div>
  )
}
