import { useEffect } from "react"
import { sendWriteFiles } from "../utils/send-write-files"
import {
  applySettingsToLocalStorage,
  collectSettingsFromLocalStorage,
  readSettingsFromRepo,
  SETTINGS_FILE_REL_PATH,
  SETTINGS_VERSION,
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
function getChangedKeys(
  repoSettings: SyncedSettings,
): Array<{ localStorageKey: string; settingsKey: keyof SyncedSettings }> {
  const changed: Array<{ localStorageKey: string; settingsKey: keyof SyncedSettings }> = []
  for (const entry of settingsKeyMap) {
    const newValue = (repoSettings as Record<string, unknown>)[entry.settingsKey]
    if (newValue === undefined) continue
    const serialized = JSON.stringify(newValue)
    const current = localStorage.getItem(entry.localStorageKey)
    if (current !== serialized) changed.push(entry)
  }
  return changed
}

/**
 * Returns true if the current localStorage settings differ from what's in the
 * repo. Used to skip no-op commits.
 */
async function hasSettingsChanged(): Promise<boolean> {
  const current: SyncedSettings = { ...collectSettingsFromLocalStorage() }
  const repoSettings = await readSettingsFromRepo()
  if (!repoSettings) return true // no file yet, must write
  // Compare serialized forms — same stable JSON.stringify both sides
  return JSON.stringify(current) !== JSON.stringify(repoSettings)
}

/**
 * Sync user settings between localStorage and the user's GitHub repo.
 *
 * Runs when `isRepoCloned` becomes true:
 * - If `.lumen/settings.json` exists in repo with matching version, apply to localStorage
 * - Otherwise (missing or stale version), overwrite repo with current localStorage
 *
 * All git operations go through WRITE_FILES to avoid racing with pull/push.
 */
export function useSettingsSync(isRepoCloned: boolean) {
  useEffect(() => {
    if (!isRepoCloned) return

    let mounted = true

    async function sync() {
      try {
        const repoSettings = await readSettingsFromRepo()

        if (repoSettings && repoSettings._version === SETTINGS_VERSION && mounted) {
          // Repo has settings with matching version — apply to localStorage.
          // Jotai's atomWithStorage picks up the new values on next render.
          // Validate theme ID — if it references a custom theme that doesn't exist
          // on this device, fall back to "default" to prevent broken UI.
          if (repoSettings.theme?.startsWith("custom-")) {
            let themes: Array<{ id: string }> = []
            try {
              const raw = localStorage.getItem("custom-themes")
              if (raw) themes = JSON.parse(raw) as Array<{ id: string }>
            } catch {
              // Malformed localStorage — treat as empty
            }
            if (!themes.some((t) => t.id === repoSettings.theme)) {
              repoSettings.theme = "default"
            }
          }
          const changedKeys = getChangedKeys(repoSettings)
          applySettingsToLocalStorage(repoSettings)
          // Nudge Jotai atoms — storage events only fire for cross-tab changes,
          // so dispatch per-key events for same-tab atomWithStorage listeners.
          for (const { localStorageKey } of changedKeys) {
            window.dispatchEvent(
              new StorageEvent("storage", {
                key: localStorageKey,
                newValue: localStorage.getItem(localStorageKey),
              }),
            )
          }
        } else if (mounted) {
          // No settings, or stale version — overwrite repo with current localStorage.
          // Only write if the content actually differs from what's in the repo (or
          // if nothing is there yet). Prevents a redundant "initialize" commit when
          // the user has never changed anything.
          if (await hasSettingsChanged()) {
            const current = collectSettingsFromLocalStorage()
            if (Object.keys(current).length > 0) {
              const content = JSON.stringify(current, null, 2)
              sendWriteFiles({ [SETTINGS_FILE_REL_PATH]: content }, "Initialize settings")
            }
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

let saveTimeout: ReturnType<typeof setTimeout> | null = null

/**
 * Save current settings to the repo via the state machine. Debounced 500ms.
 * Skips no-op commits when nothing changed since last write.
 */
export function saveSettingsToRepo(): void {
  if (saveTimeout) clearTimeout(saveTimeout)
  saveTimeout = setTimeout(async () => {
    saveTimeout = null
    if (!(await hasSettingsChanged())) return
    const settings = collectSettingsFromLocalStorage()
    const content = JSON.stringify(settings, null, 2)
    sendWriteFiles({ [SETTINGS_FILE_REL_PATH]: content }, "Update settings")
  }, 500)
}

/**
 * Force an immediate save. Use before unmount / navigation.
 * Skips no-op commits — common case when user just viewed Settings without editing.
 */
export async function flushSettingsToRepo(): Promise<void> {
  if (saveTimeout) {
    clearTimeout(saveTimeout)
    saveTimeout = null
  }
  if (!(await hasSettingsChanged())) return
  const settings = collectSettingsFromLocalStorage()
  const content = JSON.stringify(settings, null, 2)
  sendWriteFiles({ [SETTINGS_FILE_REL_PATH]: content }, "Update settings")
}
