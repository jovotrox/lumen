/**
 * Persistent ring-buffer debug log for diagnosing sync issues.
 *
 * Stores the last N entries in localStorage so they survive reloads and
 * can be copied from the Settings page when reporting bugs. Each entry is
 * tagged with a per-device ID + platform so multi-device issues can be
 * correlated.
 */

const STORAGE_KEY = "lumen_debug_log"
const DEVICE_ID_KEY = "lumen_device_id"
const MAX_ENTRIES = 50

export type DebugEntry = {
  timestamp: string
  device: string
  platform: string
  category: string
  data: unknown
}

function getDeviceId(): string {
  try {
    let id = localStorage.getItem(DEVICE_ID_KEY)
    if (!id) {
      id =
        typeof crypto !== "undefined" && "randomUUID" in crypto
          ? crypto.randomUUID().slice(0, 8)
          : Math.random().toString(36).slice(2, 10)
      localStorage.setItem(DEVICE_ID_KEY, id)
    }
    return id
  } catch {
    return "unknown"
  }
}

function getPlatform(): string {
  if (typeof window === "undefined") return "unknown"
  if ("electronAPI" in window) return "Electron"
  if ("__TAURI__" in window) return "Tauri"
  return "PWA"
}

export const DEBUG_LOG_EVENT = "lumen:debug-log-updated"

/**
 * Append an entry to the debug log. Safe to call from anywhere — swallows
 * storage errors so it never interferes with normal operation.
 */
export function logDebug(category: string, data: unknown): void {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    const entries: DebugEntry[] = raw ? (JSON.parse(raw) as DebugEntry[]) : []
    entries.push({
      timestamp: new Date().toISOString(),
      device: getDeviceId(),
      platform: getPlatform(),
      category,
      data,
    })
    const trimmed = entries.length > MAX_ENTRIES ? entries.slice(-MAX_ENTRIES) : entries
    localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed))
    window.dispatchEvent(new Event(DEBUG_LOG_EVENT))
  } catch {
    // Storage quota / unavailable — swallow to never break callers
  }
}

export function getDebugLog(): DebugEntry[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? (JSON.parse(raw) as DebugEntry[]) : []
  } catch {
    return []
  }
}

/** Serialize the log to a single pasteable string. */
export function formatDebugLog(): string {
  const entries = getDebugLog()
  if (entries.length === 0) return "(empty)"
  return entries
    .map((e) => {
      const data = typeof e.data === "string" ? e.data : safeStringify(e.data)
      return `[${e.timestamp}] ${e.platform}/${e.device} ${e.category}\n${data}`
    })
    .join("\n\n")
}

function safeStringify(value: unknown): string {
  try {
    return JSON.stringify(value, null, 2)
  } catch {
    return String(value)
  }
}

export function clearDebugLog(): void {
  try {
    localStorage.removeItem(STORAGE_KEY)
    window.dispatchEvent(new Event(DEBUG_LOG_EVENT))
  } catch {
    // Swallow
  }
}
