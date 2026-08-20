import { useEffect, useRef } from 'react'

/**
 * Enables an iOS-style "swipe from the left edge" gesture to open something
 * (typically a mobile nav drawer). Listens globally so it works no matter
 * which page the user is on.
 *
 * - Touch must start within `edgeWidth` px of the left screen edge.
 * - Must move right at least `threshold` px, more horizontally than vertically.
 * - Only fires when `enabled` is true (e.g. drawer currently closed, mobile viewport).
 */
export function useEdgeSwipeOpen(onOpen: () => void, enabled: boolean, edgeWidth = 24, threshold = 60) {
  const startRef = useRef<{ x: number; y: number } | null>(null)

  useEffect(() => {
    if (!enabled) return

    function onTouchStart(e: TouchEvent) {
      const t = e.touches[0]
      if (t.clientX > edgeWidth) {
        startRef.current = null
        return
      }
      startRef.current = { x: t.clientX, y: t.clientY }
    }

    function onTouchEnd(e: TouchEvent) {
      const start = startRef.current
      startRef.current = null
      if (!start) return

      const t = e.changedTouches[0]
      const dx = t.clientX - start.x
      const dy = t.clientY - start.y

      if (dx < threshold || Math.abs(dx) < Math.abs(dy)) return

      onOpen()
    }

    document.addEventListener('touchstart', onTouchStart, { passive: true })
    document.addEventListener('touchend', onTouchEnd, { passive: true })
    return () => {
      document.removeEventListener('touchstart', onTouchStart)
      document.removeEventListener('touchend', onTouchEnd)
    }
  }, [enabled, onOpen, edgeWidth, threshold])
}
