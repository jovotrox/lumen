import { fetchIcsEvents } from "./calendar-ics"

export interface CalendarEvent {
  title: string
  start: string // ISO date string
  end: string // ISO date string
  calendar: string // calendar name (empty for ICS feeds)
  color: string // hex color
  isAllDay: boolean
  location?: string
}

export interface CalendarResult {
  events: CalendarEvent[]
  error?: string
}

// In-memory cache per URL+date
const cache = new Map<string, { result: CalendarResult; timestamp: number }>()
const CACHE_TTL = 5 * 60_000 // 5 minutes

export async function fetchCalendarEvents(
  dateString: string,
  icsUrl: string,
): Promise<CalendarResult> {
  if (!icsUrl) return { events: [] }

  const cacheKey = `${icsUrl}::${dateString}`
  const cached = cache.get(cacheKey)
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.result
  }

  try {
    const events = await fetchIcsEvents(icsUrl, dateString)
    const result: CalendarResult = { events }
    cache.set(cacheKey, { result, timestamp: Date.now() })
    return result
  } catch (e) {
    const error = (e as Error).message || "Failed to fetch calendar"
    const result: CalendarResult = { events: [], error }
    cache.set(cacheKey, { result, timestamp: Date.now() })
    return result
  }
}

export function invalidateCalendarCache(): void {
  cache.clear()
}

export function formatEventTime(event: CalendarEvent): string {
  if (event.isAllDay) return "All day"
  const start = new Date(event.start)
  const end = new Date(event.end)
  const fmt = (d: Date) => d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })
  return `${fmt(start)} – ${fmt(end)}`
}
