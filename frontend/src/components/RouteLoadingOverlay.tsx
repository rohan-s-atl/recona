'use client'

import { useEffect, useRef, useState } from 'react'
import { usePathname, useSearchParams } from 'next/navigation'
import { FrostedLoader } from './FrostedLoader'

function isModifiedClick(event: MouseEvent) {
  return event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0
}

export function RouteLoadingOverlay() {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [visible, setVisible] = useState(false)
  const timeoutRef = useRef<number | null>(null)

  useEffect(() => {
    const handleClick = (event: MouseEvent) => {
      if (isModifiedClick(event)) return
      const target = event.target instanceof Element ? event.target.closest('a[href]') : null
      if (!(target instanceof HTMLAnchorElement)) return
      if (target.target || target.hasAttribute('download')) return

      const url = new URL(target.href, window.location.href)
      if (url.origin !== window.location.origin) return
      if (url.pathname === window.location.pathname && url.search === window.location.search) return
      if (url.hash && url.pathname === window.location.pathname && url.search === window.location.search) return

      setVisible(true)
    }

    window.addEventListener('click', handleClick, { capture: true })
    return () => window.removeEventListener('click', handleClick, { capture: true })
  }, [])

  useEffect(() => {
    if (timeoutRef.current) window.clearTimeout(timeoutRef.current)
    timeoutRef.current = window.setTimeout(() => setVisible(false), 520)
    return () => {
      if (timeoutRef.current) window.clearTimeout(timeoutRef.current)
    }
  }, [pathname, searchParams])

  if (!visible) return null
  return <FrostedLoader label="Loading workspace" />
}
