import { auth, currentUser } from '@clerk/nextjs/server'

export type UserRole = 'admin' | 'analyst' | 'viewer'

const ROLE_LEVELS: Record<UserRole, number> = { viewer: 0, analyst: 1, admin: 2 }
const AUTH_TIMEOUT_MS = 2000
const hasClerkKeys = Boolean(
  process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY && process.env.CLERK_SECRET_KEY
)
const LOCAL_ADMIN_ID = 'local-admin'
const LOCAL_ORG_ID = 'local-preview'

function shouldUseClerk(): boolean {
  return hasClerkKeys || process.env.NODE_ENV === 'production'
}

async function withTimeout<T>(promise: Promise<T>, timeoutMs = AUTH_TIMEOUT_MS): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error('Auth request timed out')), timeoutMs)
  })

  try {
    return (await Promise.race([promise, timeout])) as T
  } finally {
    if (timer) clearTimeout(timer)
  }
}

export function getCurrentAuth(): { userId: string | null; orgId: string | null } {
  if (!shouldUseClerk()) return { userId: LOCAL_ADMIN_ID, orgId: LOCAL_ORG_ID }

  try {
    const { userId, orgId } = auth()
    return { userId: userId ?? null, orgId: orgId ?? null }
  } catch (error) {
    console.error('[auth] getCurrentAuth failed:', error)
    return { userId: null, orgId: null }
  }
}

export function getDataScope(): { userId?: string; orgId?: string } {
  const { userId, orgId } = getCurrentAuth()
  if (orgId) return { orgId }
  if (userId) return { userId }
  return {}
}

export async function getUserRole(): Promise<UserRole> {
  if (!shouldUseClerk()) return 'admin'

  try {
    const user = await withTimeout(currentUser())
    if (!user) return 'viewer'
    if (isLocalDevAdmin(user.emailAddresses.map((email) => email.emailAddress))) return 'admin'
    const role = (user.publicMetadata?.role ?? 'analyst') as UserRole
    return ROLE_LEVELS[role] !== undefined ? role : 'analyst'
  } catch (error) {
    console.error('[auth] getUserRole failed:', error)
    return 'viewer'
  }
}

export async function getCurrentUserLabel(): Promise<string | null> {
  if (!shouldUseClerk()) return 'Local admin'

  try {
    const user = await withTimeout(currentUser())
    if (!user) return getCurrentAuth().userId
    return user.primaryEmailAddress?.emailAddress ?? user.emailAddresses[0]?.emailAddress ?? user.id
  } catch (error) {
    console.error('[auth] getCurrentUserLabel failed:', error)
    return getCurrentAuth().userId
  }
}

export async function hasRole(minimum: UserRole): Promise<boolean> {
  const { userId } = getCurrentAuth()
  if (!userId) return false

  const role = await getUserRole()
  return ROLE_LEVELS[role] >= ROLE_LEVELS[minimum]
}

function isLocalDevAdmin(userEmails: string[]): boolean {
  if (process.env.NODE_ENV === 'production') return false
  const configuredEmails = process.env.RECONA_ADMIN_EMAILS
  if (!configuredEmails) return false

  const adminEmails = configuredEmails
    .split(',')
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean)

  return userEmails.some((email) => adminEmails.includes(email.toLowerCase()))
}
