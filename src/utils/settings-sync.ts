import { fs } from "./fs"
import { REPO_DIR } from "./git"

const SETTINGS_FILE_PATH = `${REPO_DIR}/.lumen/settings.json`
/** Relative path (from repo root) for git add */
export const SETTINGS_FILE_REL_PATH = ".lumen/settings.json"

/** Settings that sync across devices via the user's GitHub repo */
export type SyncedSettings = {
  nickname?: string
  font?: string
  theme?: string
  tempUnit?: "C" | "F"
  epaper?: boolean
  vimMode?: boolean
  hideCompletedTasks?: boolean
  calendarLayout?: "week" | "month"
  aiProvider?: "openai" | "claude"
  voiceAssistantEnabled?: boolean
  quickNoteMode?: "note" | "inbox"
  nudgeStaleTaskDays?: number
  nudgeInactiveProjectDays?: number
  nudgeInboxThreshold?: number
  nudgeNotificationsEnabled?: boolean
}

/** localStorage keys mapped to SyncedSettings keys */
export const settingsKeyMap: { localStorageKey: string; settingsKey: keyof SyncedSettings }[] = [
  { localStorageKey: "nickname", settingsKey: "nickname" },
  { localStorageKey: "font", settingsKey: "font" },
  { localStorageKey: "theme", settingsKey: "theme" },
  { localStorageKey: "temp_unit", settingsKey: "tempUnit" },
  { localStorageKey: "epaper", settingsKey: "epaper" },
  { localStorageKey: "vim-mode", settingsKey: "vimMode" },
  { localStorageKey: "hide-completed-tasks", settingsKey: "hideCompletedTasks" },
  { localStorageKey: "calendar-layout", settingsKey: "calendarLayout" },
  { localStorageKey: "ai_provider", settingsKey: "aiProvider" },
  // API keys intentionally NOT synced — they are secrets that stay in localStorage only
  { localStorageKey: "voice_assistant_enabled", settingsKey: "voiceAssistantEnabled" },
  { localStorageKey: "quick_note_mode", settingsKey: "quickNoteMode" },
  { localStorageKey: "nudge_stale_task_days", settingsKey: "nudgeStaleTaskDays" },
  { localStorageKey: "nudge_inactive_project_days", settingsKey: "nudgeInactiveProjectDays" },
  { localStorageKey: "nudge_inbox_threshold", settingsKey: "nudgeInboxThreshold" },
  { localStorageKey: "nudge_notifications_enabled", settingsKey: "nudgeNotificationsEnabled" },
]

/** Read settings from `.lumen/settings.json` in the user's repo */
export async function readSettingsFromRepo(): Promise<SyncedSettings | null> {
  try {
    const content = await fs.promises.readFile(SETTINGS_FILE_PATH, "utf8")
    return JSON.parse(content as string) as SyncedSettings
  } catch {
    return null
  }
}

/** Write settings to `.lumen/settings.json` in the user's repo */
export async function writeSettingsToRepo(settings: SyncedSettings): Promise<void> {
  try {
    await fs.promises.mkdir(`${REPO_DIR}/.lumen`)
  } catch {
    // Directory already exists
  }
  const content = JSON.stringify(settings, null, 2)
  await fs.promises.writeFile(SETTINGS_FILE_PATH, content, "utf8")
}

/** Collect current settings from localStorage into a SyncedSettings object */
export function collectSettingsFromLocalStorage(): SyncedSettings {
  const settings: SyncedSettings = {}
  for (const { localStorageKey, settingsKey } of settingsKeyMap) {
    const raw = localStorage.getItem(localStorageKey)
    if (raw !== null) {
      const record = settings as Record<string, unknown>
      try {
        record[settingsKey] = JSON.parse(raw)
      } catch {
        record[settingsKey] = raw
      }
    }
  }
  return settings
}

/** Apply synced settings to localStorage (repo → local) */
export function applySettingsToLocalStorage(settings: SyncedSettings): void {
  for (const { localStorageKey, settingsKey } of settingsKeyMap) {
    const value = (settings as Record<string, unknown>)[settingsKey]
    if (value !== undefined) {
      localStorage.setItem(localStorageKey, JSON.stringify(value))
    }
  }
}
