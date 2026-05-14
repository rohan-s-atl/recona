import { NextRequest, NextResponse } from 'next/server'
import {
  getOrganizationSettings,
  enqueueOverdueNotifications,
  getQueuedNotifications,
  markNotificationDelivered,
  markNotificationFailed,
  markNotificationSkipped,
  type NotificationOutboxRow,
} from '@/lib/db'
import { isAuthorizedCronRequest, isAuthorizedWorkerRequest } from '@/lib/security'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  return dispatchNotifications(request)
}

export async function POST(request: NextRequest) {
  return dispatchNotifications(request)
}

async function dispatchNotifications(request: NextRequest) {
  if (!isAuthorizedWorkerRequest(request) && !isAuthorizedCronRequest(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const overdueQueued = await enqueueOverdueNotifications()
  const rows = await getQueuedNotifications(25)
  const results: { id: string; status: string; error?: string }[] = []

  for (const row of rows) {
    try {
      if (row.channel === 'slack') {
        await dispatchSlack(row)
      } else {
        await dispatchEmail(row)
      }
      await markNotificationDelivered(row.id)
      results.push({ id: row.id, status: 'sent' })
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Dispatch failed'
      if (message.startsWith('SKIP:')) {
        await markNotificationSkipped(row.id, message.replace('SKIP:', ''))
        results.push({ id: row.id, status: 'skipped', error: message })
      } else {
        await markNotificationFailed(row, message)
        results.push({ id: row.id, status: 'retrying', error: message })
      }
    }
  }

  return NextResponse.json({ overdueQueued, processed: results.length, results })
}

async function dispatchSlack(row: NotificationOutboxRow) {
  const settings = await getOrganizationSettings({ orgId: row.org_id ?? undefined, userId: row.user_id ?? undefined })
  if (!settings.slack_alerts_enabled) throw new Error('SKIP:Slack alerts disabled')
  if (!settings.slack_webhook_url) throw new Error('SKIP:Slack webhook not configured')

  const response = await fetch(settings.slack_webhook_url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      channel: settings.slack_channel ?? undefined,
      text: renderNotificationText(row),
    }),
  })
  if (!response.ok) throw new Error(`Slack dispatch failed: ${response.status}`)
}

async function dispatchEmail(row: NotificationOutboxRow) {
  const settings = await getOrganizationSettings({ orgId: row.org_id ?? undefined, userId: row.user_id ?? undefined })
  if (!settings.email_alerts_enabled) throw new Error('SKIP:Email alerts disabled')
  if (!process.env.RESEND_API_KEY) throw new Error('SKIP:RESEND_API_KEY not configured')
  if (!row.recipient) throw new Error('SKIP:No email recipient')

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: process.env.NOTIFICATION_FROM_EMAIL ?? 'Recona <notifications@recona.local>',
      to: row.recipient,
      subject: notificationSubject(row),
      text: renderNotificationText(row),
    }),
  })
  if (!response.ok) throw new Error(`Email dispatch failed: ${response.status}`)
}

function notificationSubject(row: NotificationOutboxRow): string {
  if (row.event_type === 'run_complete') return 'Recona reconciliation run complete'
  if (row.event_type === 'threshold_exceeded') return 'Recona discrepancy threshold exceeded'
  if (row.event_type === 'discrepancy_assigned') return 'Recona item assigned to you'
  if (row.event_type === 'discrepancy_overdue') return 'Recona item overdue'
  return `Recona notification: ${row.event_type}`
}

function renderNotificationText(row: NotificationOutboxRow): string {
  const payload = row.payload ?? {}
  if (row.event_type === 'run_complete') {
    return `Run complete: ${payload.discrepancy_count ?? 0} discrepancies, $${payload.total_amount_at_risk ?? 0} at risk.`
  }
  if (row.event_type === 'threshold_exceeded') {
    return `Large discrepancy: ${payload.merchant ?? 'Merchant'} has $${payload.amount_at_risk ?? 0} at risk, above the $${payload.threshold ?? 0} threshold.`
  }
  if (row.event_type === 'discrepancy_assigned') {
    return `A discrepancy was assigned to you. Note: ${payload.note ?? 'No note'} Due: ${payload.due_at ?? 'No due date'}`
  }
  if (row.event_type === 'discrepancy_overdue') {
    return `Overdue discrepancy: ${payload.merchant ?? 'Merchant'} has $${payload.amount_at_risk ?? 0} at risk. It was due ${payload.due_at ?? 'earlier'}.`
  }
  return JSON.stringify(payload)
}
