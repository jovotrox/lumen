import { useSetAtom } from "jotai"
import { useEffect } from "react"
import { customThemesAtom } from "../global-state"
import { readThemesFromRepo, themesFileExists, writeThemesToRepo } from "../utils/theme-sync"
import { Theme } from "../utils/themes"

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
          // No file in repo - create one from localStorage (if any themes exist)
          const themesFromLocalStorage = localStorage.getItem("custom-themes")
          if (themesFromLocalStorage) {
            try {
              const parsed = JSON.parse(themesFromLocalStorage) as unknown
              if (Array.isArray(parsed) && parsed.length > 0) {
                await writeThemesToRepo(parsed as Theme[])
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
 * Call this after any change to custom themes (create/edit/delete).
 */
export async function saveCustomThemes(themes: Theme[]): Promise<void> {
  try {
    await writeThemesToRepo(themes)
  } catch (error) {
    console.error("Failed to save themes to repo:", error)
    // Don't throw - localStorage will still be updated by Jotai
  }
}
