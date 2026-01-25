import { useEffect, useState } from "react"
import { isTauri } from "../utils/tauri"

const VERSION_URL = "https://jovotrox.github.io/lumen/version.json"
const LOCAL_VERSION_KEY = "lumen-frontend-version"

interface VersionInfo {
  frontend: string
  timestamp: string
  shell: string
}

export function useUpdateNotifier() {
  const [updateAvailable, setUpdateAvailable] = useState(false)
  const [newVersion, setNewVersion] = useState<string | null>(null)

  useEffect(() => {
    // Only check for updates in Tauri app
    if (!isTauri()) return

    async function checkVersion() {
      try {
        const response = await fetch(VERSION_URL, {
          cache: "no-store",
        })

        if (!response.ok) return

        const remote = (await response.json()) as VersionInfo
        const local = localStorage.getItem(LOCAL_VERSION_KEY)

        // If we have a stored version and it's different, show update banner
        if (local && local !== remote.frontend) {
          setUpdateAvailable(true)
          setNewVersion(remote.frontend)
        }

        // Always store the current remote version
        localStorage.setItem(LOCAL_VERSION_KEY, remote.frontend)
      } catch (error) {
        // Silently fail - network might be unavailable
        console.debug("Could not check for updates:", error)
      }
    }

    checkVersion()
  }, [])

  const dismiss = () => setUpdateAvailable(false)

  const refresh = () => window.location.reload()

  return { updateAvailable, newVersion, dismiss, refresh }
}
