import { useEffect } from "react"
import { isElectron } from "../utils/electron"
import { isTauri, openExternal } from "../utils/tauri"

/**
 * Hook that intercepts clicks on external links and opens them in the system browser.
 * Only active when running inside Tauri or Electron.
 */
export function useExternalLinks() {
  useEffect(() => {
    if (!isTauri() && !isElectron()) return

    const handleClick = (event: MouseEvent) => {
      const target = event.target as HTMLElement
      const anchor = target.closest("a")

      if (!anchor) return

      const href = anchor.getAttribute("href")
      const targetAttr = anchor.getAttribute("target")

      // Only intercept external links (http/https with target="_blank")
      if (
        href &&
        (href.startsWith("http://") || href.startsWith("https://")) &&
        targetAttr === "_blank"
      ) {
        event.preventDefault()
        event.stopPropagation()
        openExternal(href)
      }
    }

    // Use capture phase to intercept before React handlers
    document.addEventListener("click", handleClick, true)
    return () => document.removeEventListener("click", handleClick, true)
  }, [])
}
