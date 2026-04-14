import { useAtomValue, useSetAtom } from "jotai"
import { useEffect } from "react"
import { customThemesAtom, isRepoClonedAtom } from "../global-state"
import { sendWriteFiles } from "../utils/send-write-files"
import { readThemesFromRepo, themesFileExists } from "../utils/theme-sync"
import { Theme } from "../utils/themes"

const THEMES_FILE_REL_PATH = ".lumen/themes.json"

/**
 * Hook to sync custom themes between localStorage and the user's GitHub repo.
 *
 * On mount (when repo is cloned):
 * - If `.lumen/themes.json` exists in repo, load from there and update localStorage
 * - Otherwise, create `.lumen/themes.json` from localStorage via WRITE_FILES
 *
 * Usage: Call this hook once in the app root component.
 */
export function useThemeSync() {
  const setCustomThemes = useSetAtom(customThemesAtom)
  const isRepoCloned = useAtomValue(isRepoClonedAtom)

  useEffect(() => {
    if (!isRepoCloned) return

    let mounted = true

    async function sync() {
      try {
        const fileExists = await themesFileExists()

        if (fileExists) {
          // Repo file exists - load from repo and update localStorage
          const themesFromRepo = await readThemesFromRepo()
          if (mounted) {
            setCustomThemes(themesFromRepo)
          }
        } else {
          // No file in repo - create one from localStorage via state machine
          const themesFromLocalStorage = localStorage.getItem("custom-themes")
          if (themesFromLocalStorage) {
            try {
              const parsed = JSON.parse(themesFromLocalStorage) as unknown
              if (Array.isArray(parsed) && parsed.length > 0) {
                const content = JSON.stringify(parsed, null, 2)
                sendWriteFiles(
                  { [THEMES_FILE_REL_PATH]: content },
                  "Initialize themes from localStorage",
                )
              }
            } catch {
              // Invalid JSON in localStorage - ignore
            }
          }
        }
      } catch (error) {
        // Repo not available yet or other error - ignore
        console.debug("Theme sync skipped:", error)
      }
    }

    sync()

    return () => {
      mounted = false
    }
  }, [setCustomThemes, isRepoCloned])
}

/**
 * Save custom themes to both localStorage and the user's GitHub repo.
 * Routes through the state machine's WRITE_FILES to avoid racing with sync.
 */
export function saveCustomThemes(themes: Theme[]): void {
  const content = JSON.stringify(themes, null, 2)
  sendWriteFiles({ [THEMES_FILE_REL_PATH]: content }, "Update themes")
}
