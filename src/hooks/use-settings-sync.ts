import { useEffect } from "react"
import { getDefaultStore } from "jotai"
import { globalStateMachineAtom } from "../global-state"
import {
  applySettingsToLocalStorage,
  collectSettingsFromLocalStorage,
  readSettingsFromRepo,
  SETTINGS_FILE_REL_PATH,
  settingsKeyMap,
  SyncedSettings,
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
 * Runs when `isRepoCloned` becomes true:
 * - If `.lumen/settings.json` exists in repo, apply to localStorage (repo wins)
 * - Otherwise, create `.lumen/settings.json` from localStorage via WRITE_FILES
 *
 * All git operations (add/commit) go through the state machine's WRITE_FILES
 * event to avoid racing with pull/push. Never call gitAdd/gitCommit directly.
 */
export function useSettingsSync(isRepoCloned: boolean) {
  useEffect(() => {
    if (!isRepoCloned) return

    let mounted = true

    async function sync() {
      try {
        const repoSettings = await readSettingsFromRepo()

        if (repoSettings && mounted) {
          // Repo has settings — apply to localStorage (repo is source of truth).
          // Jotai's atomWithStorage picks up the new values on next render;
          // no reload needed.
          const willChange = applyWouldChangeLocalStorage(repoSettings)
          applySettingsToLocalStorage(repoSettings)
          if (willChange) {
            // Nudge Jotai atoms that use atomWithStorage — the storage event
            // only fires for cross-tab changes, so dispatch one for same-tab.
            window.dispatchEvent(new StorageEvent("storage"))
          }
        } else if (mounted) {
          // No settings in repo — save current localStorage settings via state machine
          const current = collectSettingsFromLocalStorage()
          if (Object.keys(current).length > 0) {
            const content = JSON.stringify(current, null, 2)
            sendWriteFiles({ [SETTINGS_FILE_REL_PATH]: content }, "Initialize settings")
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
  }, [isRepoCloned])
}

/**
 * Send a WRITE_FILES event to the state machine via the Jotai store.
 * This serializes git operations (add/commit) with pull/push.
 */
function sendWriteFiles(files: Record<string, string | null>, commitMessage?: string): void {
  const store = getDefaultStore()
  store.set(globalStateMachineAtom, {
    type: "WRITE_FILES",
    markdownFiles: files,
    commitMessage,
  })
}

/**
 * Save current settings to the repo via the state machine. Debounced 500ms.
 */
export function saveSettingsToRepo(): void {
  if (saveTimeout) clearTimeout(saveTimeout)
  saveTimeout = setTimeout(() => {
    saveTimeout = null
    const settings = collectSettingsFromLocalStorage()
    const content = JSON.stringify(settings, null, 2)
    sendWriteFiles({ [SETTINGS_FILE_REL_PATH]: content }, "Update settings")
  }, 500)
}

let saveTimeout: ReturnType<typeof setTimeout> | null = null

/**
 * Force an immediate save. Use before unmount / navigation.
 */
export async function flushSettingsToRepo(): Promise<void> {
  if (saveTimeout) {
    clearTimeout(saveTimeout)
    saveTimeout = null
  }
  const settings = collectSettingsFromLocalStorage()
  const content = JSON.stringify(settings, null, 2)
  sendWriteFiles({ [SETTINGS_FILE_REL_PATH]: content }, "Update settings")
}
