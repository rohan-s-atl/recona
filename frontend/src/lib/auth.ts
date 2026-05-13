import { auth, currentUser } from '@clerk/nextjs/server'

export type UserRole = 'admin' | 'analyst' | 'viewer'

const ROLE_LEVELS: Record<UserRole, number> = { viewer: 0, analyst: 1, admin: 2 }
const AUTH_TIMEOUT_MS = 2000

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
  try {
    const user = await withTimeout(currentUser())
    if (!user) return 'viewer'
    const role = (user.publicMetadata?.role ?? 'analyst') as UserRole
    return ROLE_LEVELS[role] !== undefined ? role : 'analyst'
  } catch (error) {
    console.error('[auth] getUserRole failed:', error)
    return 'viewer'
  }
}

export async function hasRole(minimum: UserRole): Promise<boolean> {
  const role = await getUserRole()
  return ROLE_LEVELS[role] >= ROLE_LEVELS[minimum]
}
