import { useRef } from 'react'
import type { TouchEvent } from 'react'

/**
 * Generic swipe-to-switch-tab gesture handler for mobile.
 *
 * Tabs are ordered left-to-right in `tabs`. Swiping right moves to the
 * next tab in the list (the one visually to the right); swiping left
 * moves to the previous tab (the one visually to the left).
 *
 * Usage:
 *   const swipe = useSwipeTabs(['posts', 'listings'] as const, profileTab, setProfileTab)
 *   <div {...swipe}>...</div>
 */
export function useSwipeTabs<T extends string>(
  tabs: readonly T[],
  current: T,
  onChange: (tab: T) => void,
  threshold = 50,
) {
  const touchStartRef = useRef<{ x: number; y: number } | null>(null)

  function onTouchStart(e: TouchEvent) {
    const t = e.touches[0]
    touchStartRef.current = { x: t.clientX, y: t.clientY }
  }

  function onTouchEnd(e: TouchEvent) {
    const start = touchStartRef.current
    touchStartRef.current = null
    if (!start) return

    const t = e.changedTouches[0]
    const dx = t.clientX - start.x
    const dy = t.clientY - start.y

    if (Math.abs(dx) < threshold || Math.abs(dx) < Math.abs(dy)) return

    // A horizontal swipe was recognized here — stop it from bubbling up so
    // the global "swipe anywhere to open the nav drawer" listener doesn't
    // also fire for the same gesture. Tab areas own their own swipes.
    e.stopPropagation()

    const idx = tabs.indexOf(current)
    if (idx === -1) return

    if (dx > 0) {
      // swiped right -> move to the next tab (to the right)
      const next = tabs[idx + 1]
      if (next) onChange(next)
    } else {
      // swiped left -> move to the previous tab (to the left)
      const prev = tabs[idx - 1]
      if (prev) onChange(prev)
    }
  }

  return { onTouchStart, onTouchEnd }
}
