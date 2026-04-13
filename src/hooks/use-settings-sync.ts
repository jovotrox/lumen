import { useEffect } from "react"
import { gitAdd, gitCommit } from "../utils/git"
import {
  applySettingsToLocalStorage,
  collectSettingsFromLocalStorage,
  readSettingsFromRepo,
  SETTINGS_FILE_REL_PATH,
  settingsKeyMap,
  SyncedSettings,
  writeSettingsToRepo,
} from "../utils/settings-sync"

/**
 * Returns true iff applying `repoSettings` to localStorage would change at
 * least one value. Crucially, we only look at keys that exist in repoSettings —
 * extra local-only keys (present in localStorage but missing in the repo file)
 * don't count as a mismatch, since `applySettingsToLocalStorage` ignores
 * undefined values and leaves them untouched.
 */
function applyWouldChangeLocalStorage(repoSettings: SyncedSettings): boolean {
  for (const { localStorageKey, settingsKey } of settingsKeyMap) {
    const newValue = (repoSettings as Record<string, unknown>)[settingsKey]
    if (newValue === undefined) continue
    const serialized = JSON.stringify(newValue)
    const current = localStorage.getItem(localStorageKey)
    if (current !== serialized) return true
  }
  return false
}

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
          // Repo has settings — apply to localStorage (repo is source of truth).
          // Only reload if the apply will actually change a value; otherwise we'd
          // loop forever on repos that have fewer keys than localStorage.
          const willChange = applyWouldChangeLocalStorage(repoSettings)
          applySettingsToLocalStorage(repoSettings)
          if (willChange) {
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

async function saveSettingsToRepoNow(): Promise<void> {
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

// Trailing-edge debounce (500ms) so rapid successive changes — e.g. drag-
// reordering pinned notes a few times in a row — collapse into one git
// commit instead of racing with isomorphic-git's file lock. `flush` forces
// an immediate save when the caller needs it (settings page unmount).
let saveTimeout: ReturnType<typeof setTimeout> | null = null
let inFlight: Promise<void> | null = null

/**
 * Save current settings to the repo. Debounced by 500ms. Safe to call rapidly.
 */
export function saveSettingsToRepo(): void {
  if (saveTimeout) clearTimeout(saveTimeout)
  saveTimeout = setTimeout(() => {
    saveTimeout = null
    // Chain onto any in-flight save so we never have two concurrent git writes.
    inFlight = (inFlight ?? Promise.resolve()).then(saveSettingsToRepoNow)
  }, 500)
}

/**
 * Force an immediate save, awaiting any pending debounce + in-flight write.
 * Use before unmount / navigation when the caller needs persistence completed.
 */
export async function flushSettingsToRepo(): Promise<void> {
  if (saveTimeout) {
    clearTimeout(saveTimeout)
    saveTimeout = null
  }
  inFlight = (inFlight ?? Promise.resolve()).then(saveSettingsToRepoNow)
  await inFlight
}
