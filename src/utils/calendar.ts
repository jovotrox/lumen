import { fetchIcsEvents } from "./calendar-ics"

export interface CalendarFeed {
  id: string
  name: string
  url: string
  color: string // hex
  enabled: boolean
}

export interface CalendarEvent {
  title: string
  start: string // ISO date string
  end: string // ISO date string
  calendar: string // feed name
  color: string // hex (from feed)
  isAllDay: boolean
  location?: string
}

export interface FeedFetchResult {
  feedId: string
  feedName: string
  events: CalendarEvent[]
  error?: string
}

// Apple-inspired palette for feed colors
export const FEED_COLORS = [
  "#FF3B30", // red
  "#FF9500", // orange
  "#FFCC00", // yellow
  "#34C759", // green
  "#007AFF", // blue
  "#5856D6", // indigo
  "#AF52DE", // purple
  "#FF2D92", // pink
] as const

// In-memory cache per URL+date
const cache = new Map<string, { result: FeedFetchResult; timestamp: number }>()
const CACHE_TTL = 5 * 60_000 // 5 minutes

/**
 * Fetch events for a single feed. Uses cache to avoid repeated fetches.
 */
export async function fetchFeedEvents(
  feed: CalendarFeed,
  dateString: string,
): Promise<FeedFetchResult> {
  if (!feed.url) {
    return { feedId: feed.id, feedName: feed.name, events: [] }
  }

  const cacheKey = `${feed.url}::${dateString}`
  const cached = cache.get(cacheKey)
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    // Re-tag cached events with current feed metadata (user may have renamed/recolored)
    return {
      ...cached.result,
      feedId: feed.id,
      feedName: feed.name,
      events: cached.result.events.map((e) => ({
        ...e,
        calendar: feed.name,
        color: feed.color,
      })),
    }
  }

  try {
    const rawEvents = await fetchIcsEvents(feed.url, dateString)
    const events = rawEvents.map((e) => ({
      ...e,
      calendar: feed.name,
      color: feed.color,
    }))
    const result: FeedFetchResult = { feedId: feed.id, feedName: feed.name, events }
    cache.set(cacheKey, { result, timestamp: Date.now() })
    return result
  } catch (e) {
    const error = (e as Error).message || "Failed to fetch calendar"
    const result: FeedFetchResult = { feedId: feed.id, feedName: feed.name, events: [], error }
    cache.set(cacheKey, { result, timestamp: Date.now() })
    return result
  }
}

/**
 * Fetch events from all enabled feeds concurrently and merge.
 */
export async function fetchAllFeedsEvents(
  feeds: CalendarFeed[],
  dateString: string,
): Promise<{ events: CalendarEvent[]; errors: Array<{ feedName: string; message: string }> }> {
  const enabled = feeds.filter((f) => f.enabled && f.url)
  const results = await Promise.all(enabled.map((f) => fetchFeedEvents(f, dateString)))

  const events: CalendarEvent[] = []
  const errors: Array<{ feedName: string; message: string }> = []

  for (const r of results) {
    events.push(...r.events)
    if (r.error) errors.push({ feedName: r.feedName, message: r.error })
  }

  // Sort: all-day first, then by start time
  events.sort((a, b) => {
    if (a.isAllDay && !b.isAllDay) return -1
    if (!a.isAllDay && b.isAllDay) return 1
    return a.start.localeCompare(b.start)
  })

  return { events, errors }
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
