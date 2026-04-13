export interface CalendarEvent {
  title: string
  start: string // ISO date string
  end: string // ISO date string
  calendar: string // calendar name
  color: string // hex color from Calendar.app
  isAllDay: boolean
  location?: string
}

// Simple in-memory cache to avoid re-fetching
const cache = new Map<string, { events: CalendarEvent[]; timestamp: number }>()
const CACHE_TTL = 60_000 // 1 minute

export async function fetchCalendarEvents(dateString: string): Promise<CalendarEvent[]> {
  // Check cache
  const cached = cache.get(dateString)
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.events
  }

  // In Electron, use IPC to get events from main process
  if (window.electronAPI?.getCalendarEvents) {
    const events = await window.electronAPI.getCalendarEvents(dateString)
    cache.set(dateString, { events, timestamp: Date.now() })
    return events
  }

  // Not available in browser
  return []
}

export function formatEventTime(event: CalendarEvent): string {
  if (event.isAllDay) return "All day"
  const start = new Date(event.start)
  const end = new Date(event.end)
  const fmt = (d: Date) => d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })
  return `${fmt(start)} – ${fmt(end)}`
}
