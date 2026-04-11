import { useEffect } from "react"
import { gitAdd, gitCommit } from "../utils/git"
import {
  applySettingsToLocalStorage,
  collectSettingsFromLocalStorage,
  readSettingsFromRepo,
  SETTINGS_FILE_REL_PATH,
  writeSettingsToRepo,
} from "../utils/settings-sync"

/**
 * Sync user settings between localStorage and the user's GitHub repo.
 *
 * On mount:
 * - If `.lumen/settings.json` exists in repo, apply to localStorage (repo wins)
 * - Otherwise, create `.lumen/settings.json` from localStorage
 *
 * Call this once in the app root component, after repo is cloned.
 */
export function useSettingsSync() {
  useEffect(() => {
    let mounted = true

    async function sync() {
      try {
        const repoSettings = await readSettingsFromRepo()

        if (repoSettings && mounted) {
          // Repo has settings — apply to localStorage (repo is source of truth)
          applySettingsToLocalStorage(repoSettings)
          // Reload to pick up changes in Jotai atoms (they read from localStorage on init)
          // Only reload if settings actually differ from current
          const current = collectSettingsFromLocalStorage()
          const changed = JSON.stringify(current) !== JSON.stringify(repoSettings)
          if (changed) {
            window.location.reload()
          }
        } else {
          // No settings in repo — save current localStorage settings to repo
          const current = collectSettingsFromLocalStorage()
          if (Object.keys(current).length > 0) {
            await writeSettingsToRepo(current)
            await gitAdd([SETTINGS_FILE_REL_PATH])
            await gitCommit("Initialize settings from localStorage")
          }
        }
      } catch (error) {
        console.debug("Settings sync skipped:", error)
      }
    }

    sync()

    return () => {
      mounted = false
    }
  }, [])
}

/**
 * Save current settings to the repo. Call after any setting change.
 */
export async function saveSettingsToRepo(): Promise<void> {
  try {
    const settings = collectSettingsFromLocalStorage()
    const existing = await readSettingsFromRepo()
    if (existing && JSON.stringify(existing) === JSON.stringify(settings)) {
      return // Nothing changed
    }
    await writeSettingsToRepo(settings)
    await gitAdd([SETTINGS_FILE_REL_PATH])
    await gitCommit("Update settings")
  } catch (error) {
    console.error("Failed to save settings to repo:", error)
  }
}
