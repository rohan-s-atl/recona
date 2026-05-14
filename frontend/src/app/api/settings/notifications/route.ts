import { NextRequest, NextResponse } from 'next/server'
import { getDataScope, hasRole } from '@/lib/auth'
import { getOrganizationSettings, updateOrganizationSettings } from '@/lib/db'

export const dynamic = 'force-dynamic'

export async function GET() {
  if (!(await hasRole('admin'))) {
    return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
  }

  const settings = await getOrganizationSettings(getDataScope())
  return NextResponse.json(settings)
}

export async function PATCH(request: NextRequest) {
  if (!(await hasRole('admin'))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = (await request.json()) as {
    alertThresholdDollars?: number
    slackWebhookUrl?: string | null
    slackChannel?: string | null
    weeklyDigestEnabled?: boolean
    emailAlertsEnabled?: boolean
    slackAlertsEnabled?: boolean
  }

  const settings = await updateOrganizationSettings(getDataScope(), {
    alert_threshold_cents:
      body.alertThresholdDollars === undefined ? undefined : Math.max(0, Math.round(body.alertThresholdDollars * 100)),
    slack_webhook_url: body.slackWebhookUrl,
    slack_channel: body.slackChannel,
    weekly_digest_enabled: body.weeklyDigestEnabled,
    email_alerts_enabled: body.emailAlertsEnabled,
    slack_alerts_enabled: body.slackAlertsEnabled,
  })

  if (!settings) return NextResponse.json({ error: 'Unable to save settings' }, { status: 500 })
  return NextResponse.json(settings)
}
