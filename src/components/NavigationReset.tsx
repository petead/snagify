"use client"
import { useEffect } from "react"
import { usePathname } from "next/navigation"

/**
 * Resets scroll position and viewport zoom on every route change.
 * Fixes iOS Safari zoom persistence when navigating between pages.
 */
export function NavigationReset() {
  const pathname = usePathname()

  useEffect(() => {
    // Blur any focused input to dismiss keyboard
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur()
    }

    // Scroll to top
    window.scrollTo({ top: 0, left: 0, behavior: "instant" as ScrollBehavior })

    // Reset viewport zoom by temporarily manipulating the meta viewport
    // This forces iOS Safari to reset its zoom level
    const viewport = document.querySelector('meta[name="viewport"]')
    if (viewport) {
      const original = viewport.getAttribute("content") || ""
      // Briefly set maximum-scale=1 to reset zoom, then restore
      viewport.setAttribute(
        "content",
        "width=device-width, initial-scale=1, maximum-scale=1"
      )
      // Restore after a frame so zoom is reset but user can still pinch-zoom
      requestAnimationFrame(() => {
        viewport.setAttribute("content", original)
      })
    }
  }, [pathname])

  return null
}
