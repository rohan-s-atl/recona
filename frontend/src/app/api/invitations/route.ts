import { NextRequest, NextResponse } from 'next/server'
import { auth, clerkClient } from '@clerk/nextjs/server'
import { hasRole } from '@/lib/auth'
import { logAudit } from '@/lib/db'
import { getClientIp } from '@/lib/rateLimit'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type AppRole = 'admin' | 'analyst' | 'viewer'

const APP_ROLES: AppRole[] = ['admin', 'analyst', 'viewer']

export async function POST(request: NextRequest) {
  if (!(await hasRole('admin'))) {
    return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
  }

  const { userId, orgId } = auth()
  if (!userId || !orgId) {
    return NextResponse.json(
      { error: 'Select or create a Clerk organization before inviting teammates.' },
      { status: 400 }
    )
  }

  const body = (await request.json()) as { email?: string; role?: AppRole }
  const email = body.email?.trim().toLowerCase()
  const appRole = body.role ?? 'analyst'

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: 'Enter a valid email address.' }, { status: 400 })
  }

  if (!APP_ROLES.includes(appRole)) {
    return NextResponse.json({ error: 'Invalid role.' }, { status: 400 })
  }

  const invitation = await clerkClient.organizations.createOrganizationInvitation({
    organizationId: orgId,
    inviterUserId: userId,
    emailAddress: email,
    role: appRole === 'admin' ? 'org:admin' : 'org:member',
    redirectUrl: `${process.env.NEXT_PUBLIC_APP_URL ?? request.nextUrl.origin}/sign-up`,
    publicMetadata: { role: appRole },
  })

  await logAudit({
    action: 'teammate_invited',
    userId,
    orgId,
    ipAddress: getClientIp(request.headers),
    metadata: {
      email,
      role: appRole,
      invitation_id: invitation.id,
    },
  })

  return NextResponse.json({
    id: invitation.id,
    email: invitation.emailAddress,
    role: appRole,
    status: invitation.status ?? 'pending',
  })
}
