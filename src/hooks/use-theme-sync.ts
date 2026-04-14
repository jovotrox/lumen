import { useSetAtom } from "jotai"
import { getDefaultStore } from "jotai"
import { useEffect } from "react"
import { customThemesAtom, globalStateMachineAtom } from "../global-state"
import { readThemesFromRepo, themesFileExists } from "../utils/theme-sync"
import { Theme } from "../utils/themes"

const THEMES_FILE_REL_PATH = ".lumen/themes.json"

/**
 * Hook to sync custom themes between localStorage and the user's GitHub repo.
 *
 * On mount:
 * - If `.lumen/themes.json` exists in repo, load from there and update localStorage
 * - Otherwise, create `.lumen/themes.json` from localStorage (if any themes exist)
 *
 * Usage: Call this hook once in the app root component.
 */
export function useThemeSync() {
  const setCustomThemes = useSetAtom(customThemesAtom)

  useEffect(() => {
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
  }, [setCustomThemes])
}

/**
 * Save custom themes to both localStorage and the user's GitHub repo.
 * Routes through the state machine's WRITE_FILES to avoid racing with sync.
 */
export async function saveCustomThemes(themes: Theme[]): Promise<void> {
  try {
    const content = JSON.stringify(themes, null, 2)
    sendWriteFiles({ [THEMES_FILE_REL_PATH]: content }, "Update themes")
  } catch (error) {
    console.error("Failed to save themes to repo:", error)
  }
}

function sendWriteFiles(files: Record<string, string | null>, commitMessage?: string): void {
  const store = getDefaultStore()
  store.set(globalStateMachineAtom, {
    type: "WRITE_FILES",
    markdownFiles: files,
    commitMessage,
  })
}
