import { useEffect, useState } from "react"

const VERSION_URL = "https://jovotrox.github.io/lumen/version.json"
const LOCAL_VERSION_KEY = "lumen-frontend-version"
const POLLING_INTERVAL_MS = 12 * 60 * 60 * 1000 // 12 hours

interface VersionInfo {
  frontend: string
  timestamp: string
  shell: string
}

function hasDraftsInLocalStorage(): boolean {
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)
      if (key && key.startsWith("draft")) return true
    }
  } catch {
    // Ignore storage errors
  }
  return false
}

async function clearCachesAndReload() {
  // Clear caches to ensure fresh assets are loaded
  if ("caches" in window) {
    try {
      const cacheNames = await caches.keys()
      await Promise.all(cacheNames.map((name) => caches.delete(name)))
    } catch (error) {
      console.debug("Could not clear caches:", error)
    }
  }

  // Unregister service workers to prevent stale cache
  if ("serviceWorker" in navigator) {
    try {
      const registrations = await navigator.serviceWorker.getRegistrations()
      await Promise.all(registrations.map((reg) => reg.unregister()))
    } catch (error) {
      console.debug("Could not unregister service workers:", error)
    }
  }

  // Force hard reload
  window.location.reload()
}

export function useUpdateNotifier() {
  const [updateAvailable, setUpdateAvailable] = useState(false)
  const [newVersion, setNewVersion] = useState<string | null>(null)

  useEffect(() => {
    async function checkVersion() {
      try {
        const response = await fetch(VERSION_URL, {
          cache: "no-store",
        })

        if (!response.ok) return

        const remote = (await response.json()) as VersionInfo
        const local = localStorage.getItem(LOCAL_VERSION_KEY)

        // Always store the current remote version
        localStorage.setItem(LOCAL_VERSION_KEY, remote.frontend)

        // If we have a stored version and it's different, update is available
        if (local && local !== remote.frontend) {
          if (hasDraftsInLocalStorage()) {
            // Show banner so user can refresh manually when ready
            setUpdateAvailable(true)
            setNewVersion(remote.frontend)
          } else {
            // No unsaved drafts - auto-refresh
            clearCachesAndReload()
          }
        }
      } catch (error) {
        // Silently fail - network might be unavailable
        console.debug("Could not check for updates:", error)
      }
    }

    // Check on mount
    checkVersion()

    // Poll every 12 hours
    const intervalId = setInterval(checkVersion, POLLING_INTERVAL_MS)

    // Check when app regains focus
    function handleVisibilityChange() {
      if (document.visibilityState === "visible") {
        checkVersion()
      }
    }
    document.addEventListener("visibilitychange", handleVisibilityChange)

    return () => {
      clearInterval(intervalId)
      document.removeEventListener("visibilitychange", handleVisibilityChange)
    }
  }, [])

  const dismiss = () => setUpdateAvailable(false)

  return { updateAvailable, newVersion, dismiss, refresh: clearCachesAndReload }
}
