import { fs } from "./fs"
import { REPO_DIR } from "./git"

/**
 * Settings sync is environment-scoped to avoid dev runs polluting the user's
 * production settings (the shared GitHub repo). Dev writes to `settings.dev.json`
 * and, on first run, seeds from the prod `settings.json` if it exists.
 */
const IS_DEV = import.meta.env.DEV

/** Relative path (from repo root) used for git add — scoped to env */
export const SETTINGS_FILE_REL_PATH = IS_DEV ? ".lumen/settings.dev.json" : ".lumen/settings.json"

const SETTINGS_FILE_PATH = `${REPO_DIR}/${SETTINGS_FILE_REL_PATH}`
const SETTINGS_FILE_PATH_PROD = `${REPO_DIR}/.lumen/settings.json`

import type { CalendarFeed } from "./calendar"

/** Settings that sync across devices via the user's GitHub repo */
export type SyncedSettings = {
  nickname?: string
  font?: string
  theme?: string
  tempUnit?: "C" | "F"
  epaper?: boolean
  vimMode?: boolean
  livePreview?: boolean
  hideCompletedTasks?: boolean
  calendarLayout?: "week" | "month"
  calendarIntegration?: boolean
  calendarFeeds?: CalendarFeed[]
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
  { localStorageKey: "live-preview", settingsKey: "livePreview" },
  { localStorageKey: "hide-completed-tasks", settingsKey: "hideCompletedTasks" },
  { localStorageKey: "calendar-layout", settingsKey: "calendarLayout" },
  { localStorageKey: "calendar-integration", settingsKey: "calendarIntegration" },
  { localStorageKey: "calendar-feeds", settingsKey: "calendarFeeds" },
  { localStorageKey: "ai_provider", settingsKey: "aiProvider" },
  // API keys intentionally NOT synced — they are secrets that stay in localStorage only
  { localStorageKey: "voice_assistant_enabled", settingsKey: "voiceAssistantEnabled" },
  { localStorageKey: "quick_note_mode", settingsKey: "quickNoteMode" },
  { localStorageKey: "nudge_stale_task_days", settingsKey: "nudgeStaleTaskDays" },
  { localStorageKey: "nudge_inactive_project_days", settingsKey: "nudgeInactiveProjectDays" },
  { localStorageKey: "nudge_inbox_threshold", settingsKey: "nudgeInboxThreshold" },
  { localStorageKey: "nudge_notifications_enabled", settingsKey: "nudgeNotificationsEnabled" },
]

/**
 * Read synced settings from the user's repo.
 *
 * In dev, reads `.lumen/settings.dev.json`. If absent, falls back to the prod
 * `.lumen/settings.json` as a seed — this means the first time you run dev you
 * inherit your prod config, but any subsequent write stays in the dev file.
 *
 * In prod, reads `.lumen/settings.json` only.
 */
export async function readSettingsFromRepo(): Promise<SyncedSettings | null> {
  try {
    const content = await fs.promises.readFile(SETTINGS_FILE_PATH, "utf8")
    return JSON.parse(content as string) as SyncedSettings
  } catch {
    if (IS_DEV) {
      try {
        const content = await fs.promises.readFile(SETTINGS_FILE_PATH_PROD, "utf8")
        return JSON.parse(content as string) as SyncedSettings
      } catch {
        return null
      }
    }
    return null
  }
}

/**
 * Write synced settings to the user's repo. Always writes to the env-scoped
 * file (`settings.dev.json` in dev, `settings.json` in prod) — prod is never
 * overwritten from dev runs.
 */
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
