import type { Metadata } from 'next'
import './globals.css'
import { ClerkProvider, SignedIn, SignedOut, UserButton } from '@clerk/nextjs'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = {
  title: 'recona',
  description:
    'AI-powered billing reconciliation for financial institutions. Catch every discrepancy, automatically.',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <ClerkProvider afterSignOutUrl="/sign-in">
      <html lang="en">
        <body>
          <nav className="glass-nav sticky top-0 z-50">
            <div className="mx-auto flex max-w-[1800px] items-center justify-between px-6 lg:px-10" style={{ height: '64px' }}>
              <a href="/" className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-lg bg-blue-600 flex items-center justify-center shadow-sm shadow-blue-500/30">
                  <svg width="17" height="17" viewBox="0 0 14 14" fill="none">
                    <path d="M2 7h10M7 2v10M2 4l2 3-2 3M12 4l-2 3 2 3" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </div>
                <span className="text-base font-semibold text-gray-900 tracking-tight">recona</span>
                <span className="text-xs font-semibold bg-blue-100 text-blue-600 px-2 py-0.5 rounded-md">
                  Beta
                </span>
              </a>

              <div className="flex items-center gap-1">
                <SignedIn>
                  <a
                    href="/runs"
                    className="text-[15px] font-medium text-gray-500 hover:text-gray-900 px-3.5 py-2 rounded-lg hover:bg-black/5 transition-colors"
                  >
                    Runs
                  </a>
                  <a
                    href="/queue"
                    className="text-[15px] font-medium text-gray-500 hover:text-gray-900 px-3.5 py-2 rounded-lg hover:bg-black/5 transition-colors"
                  >
                    Queue
                  </a>
                  <a
                    href="/analytics"
                    className="text-[15px] font-medium text-gray-500 hover:text-gray-900 px-3.5 py-2 rounded-lg hover:bg-black/5 transition-colors"
                  >
                    Analytics
                  </a>
                  <a
                    href="/automation"
                    className="text-[15px] font-medium text-gray-500 hover:text-gray-900 px-3.5 py-2 rounded-lg hover:bg-black/5 transition-colors"
                  >
                    Automation
                  </a>
                  <a
                    href="/resolutions"
                    className="text-[15px] font-medium text-gray-500 hover:text-gray-900 px-3.5 py-2 rounded-lg hover:bg-black/5 transition-colors"
                  >
                    Resolutions
                  </a>
                  <a
                    href="/scorecard"
                    className="text-[15px] font-medium text-gray-500 hover:text-gray-900 px-3.5 py-2 rounded-lg hover:bg-black/5 transition-colors"
                  >
                    Scorecard
                  </a>
                  <a
                    href="/ask"
                    className="text-[15px] font-medium text-gray-500 hover:text-gray-900 px-3.5 py-2 rounded-lg hover:bg-black/5 transition-colors"
                  >
                    Ask
                  </a>
                  <a
                    href="/audit"
                    className="text-[15px] font-medium text-gray-500 hover:text-gray-900 px-3.5 py-2 rounded-lg hover:bg-black/5 transition-colors"
                  >
                    Audit
                  </a>
                  <a
                    href="/settings"
                    className="text-[15px] font-medium text-gray-500 hover:text-gray-900 px-3.5 py-2 rounded-lg hover:bg-black/5 transition-colors"
                  >
                    Settings
                  </a>
                  <a
                    href="/upload"
                    className="text-[15px] font-semibold bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors shadow-sm shadow-blue-500/25 mr-2"
                  >
                    New run
                  </a>
                  <UserButton />
                </SignedIn>
                <SignedOut>
                  <a
                    href="/sign-in"
                    className="text-[15px] font-semibold bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors shadow-sm shadow-blue-500/25"
                  >
                    Sign in
                  </a>
                </SignedOut>
              </div>
            </div>
          </nav>
          {children}
        </body>
      </html>
    </ClerkProvider>
  )
}
