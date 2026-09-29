import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server'

const isPublicRoute = createRouteMatcher([
  '/sign-in(.*)',
  '/sign-up(.*)',
  '/api/health',
  '/api/notifications/dispatch',
  '/api/reconcile/internal',
  '/api/schedules/dispatch',
  '/share(.*)',
  '/monitoring(.*)',
])

const hasClerkKeys = Boolean(
  process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY && process.env.CLERK_SECRET_KEY
)

const authenticatedMiddleware = clerkMiddleware((auth, request) => {
  if (!isPublicRoute(request)) {
    auth().protect()
  }
})

export default hasClerkKeys || process.env.NODE_ENV === 'production'
  ? authenticatedMiddleware
  : function localPreviewMiddleware() {}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
