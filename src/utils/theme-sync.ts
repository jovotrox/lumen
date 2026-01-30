import { fs } from "./fs"
import { REPO_DIR } from "./git"
import { Theme } from "./themes"

const THEMES_FILE_PATH = `${REPO_DIR}/.lumen/themes.json`

/**
 * Read custom themes from `.lumen/themes.json` in the user's repo.
 * Returns empty array if file doesn't exist.
 */
export async function readThemesFromRepo(): Promise<Theme[]> {
  try {
    const content = await fs.promises.readFile(THEMES_FILE_PATH, "utf8")
    const parsed = JSON.parse(content as string) as unknown
    if (Array.isArray(parsed)) {
      return parsed as Theme[]
    }
    return []
  } catch (error) {
    // File doesn't exist or invalid JSON - return empty array
    return []
  }
}

/**
 * Write custom themes to `.lumen/themes.json` in the user's repo.
 * Creates `.lumen` directory if it doesn't exist.
 */
export async function writeThemesToRepo(themes: Theme[]): Promise<void> {
  try {
    // Ensure .lumen directory exists
    await fs.promises.mkdir(`${REPO_DIR}/.lumen`)
  } catch (error) {
    // Directory already exists - ignore error
  }

  const content = JSON.stringify(themes, null, 2)
  await fs.promises.writeFile(THEMES_FILE_PATH, content, "utf8")
}

/**
 * Check if `.lumen/themes.json` exists in the repo.
 */
export async function themesFileExists(): Promise<boolean> {
  try {
    await fs.promises.stat(THEMES_FILE_PATH)
    return true
  } catch {
    return false
  }
}
