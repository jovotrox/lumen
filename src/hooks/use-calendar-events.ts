import { atom, useAtomValue, useSetAtom } from "jotai"
import { useEffect, useState } from "react"
import { calendarFeedsAtom, calendarIntegrationAtom } from "../global-state"
import {
  evictOutsideRange,
  getCachedEntry,
  setCachedEntry,
  type CachedEntry,
} from "../utils/calendar-cache"
import type { CalendarEvent, CalendarFeed } from "../utils/calendar"
import { fetchIcsEvents } from "../utils/calendar-ics"

const PREFETCH_RADIUS_DAYS = 3
const PREFETCH_FRESH_MS = 5 * 60_000

export interface UseCalendarEventsResult {
  events: CalendarEvent[]
  errors: Array<{ feedName: string; message: string }>
  /** True ONLY when there is no cached data yet (cold path). */
  isLoading: boolean
  /** True during the background refetch. UI usually ignores this. */
  isRevalidating: boolean
}

// Global tick that increments on window focus. All hooks watch the same atom
// so that one focus event triggers revalidation in every mounted instance.
const focusTickAtom = atom(0)

function useFocusInvalidationTick(): number {
  const tick = useAtomValue(focusTickAtom)
  const setTick = useSetAtom(focusTickAtom)
  useEffect(() => {
    const onFocus = () => setTick((t) => t + 1)
    window.addEventListener("focus", onFocus)
    return () => window.removeEventListener("focus", onFocus)
  }, [setTick])
  return tick
}

async function fetchAndCache(feed: CalendarFeed, dateString: string) {
  try {
    const rawEvents = await fetchIcsEvents(feed.url, dateString, AbortSignal.timeout(15_000))
    const events = rawEvents.map((e) => ({ ...e, calendar: feed.name, color: feed.color }))
    await setCachedEntry(feed.url, dateString, { events, fetchedAt: Date.now() })
    return { feed, events, error: undefined as string | undefined }
  } catch (e) {
    const message = (e as Error).message || "Failed to fetch calendar"
    await setCachedEntry(feed.url, dateString, {
      events: [],
      fetchedAt: Date.now(),
      error: message,
    })
    return { feed, events: [], error: message }
  }
}

async function fetchAndCacheIfStale(feed: CalendarFeed, dateString: string) {
  // Only used by prefetch — for the visible day we always revalidate.
  const cached = await getCachedEntry(feed.url, dateString)
  if (cached && Date.now() - cached.fetchedAt < PREFETCH_FRESH_MS) return
  await fetchAndCache(feed, dateString)
}

function surroundingDates(centerDate: string, radius: number): string[] {
  const result: string[] = []
  const [y, m, d] = centerDate.split("-").map(Number)
  for (let offset = -radius; offset <= radius; offset++) {
    const dt = new Date(y, m - 1, d + offset) // local time, respects DST
    const yyyy = dt.getFullYear()
    const mm = String(dt.getMonth() + 1).padStart(2, "0")
    const dd = String(dt.getDate()).padStart(2, "0")
    result.push(`${yyyy}-${mm}-${dd}`)
  }
  return result
}

async function prefetchSurrounding(feeds: CalendarFeed[], centerDate: string) {
  const dates = surroundingDates(centerDate, PREFETCH_RADIUS_DAYS) // 7 days total
  // Day-by-day (not all in parallel) to avoid hammering the feed with 21 concurrent
  // requests. Within a day, all feeds fetch in parallel (typically 3 feeds).
  // Bail on first failure to avoid cascading timeouts on unreachable feeds.
  try {
    for (const date of dates) {
      await Promise.all(feeds.map((f) => fetchAndCacheIfStale(f, date)))
    }
    const validUrls = new Set(feeds.map((f) => f.url))
    await evictOutsideRange(validUrls, dates[0], dates[dates.length - 1])
  } catch {
    // Feed unreachable — stop prefetching to avoid freezing the UI
  }
}

function sortEvents(events: CalendarEvent[]): CalendarEvent[] {
  return [...events].sort((a, b) => {
    if (a.isAllDay && !b.isAllDay) return -1
    if (!a.isAllDay && b.isAllDay) return 1
    return a.start.localeCompare(b.start)
  })
}

function mergeCachedResults(feeds: CalendarFeed[], cached: Array<CachedEntry | undefined>) {
  const events: CalendarEvent[] = []
  const errors: Array<{ feedName: string; message: string }> = []
  feeds.forEach((feed, i) => {
    const entry = cached[i]
    if (!entry) return
    // Re-tag with current feed metadata in case user renamed/recolored.
    const tagged = entry.events.map((e) => ({ ...e, calendar: feed.name, color: feed.color }))
    events.push(...tagged)
    if (entry.error) errors.push({ feedName: feed.name, message: entry.error })
  })
  return { events: sortEvents(events), errors }
}

function mergeFreshResults(
  results: Array<{ feed: CalendarFeed; events: CalendarEvent[]; error: string | undefined }>,
) {
  const events: CalendarEvent[] = []
  const errors: Array<{ feedName: string; message: string }> = []
  for (const r of results) {
    events.push(...r.events)
    if (r.error) errors.push({ feedName: r.feed.name, message: r.error })
  }
  return { events: sortEvents(events), errors }
}

export function useCalendarEvents(dateString: string): UseCalendarEventsResult {
  const enabled = useAtomValue(calendarIntegrationAtom)
  const feeds = useAtomValue(calendarFeedsAtom)
  const focusTick = useFocusInvalidationTick()

  const activeFeeds = feeds.filter((f) => f.enabled && f.url)
  const feedKey = JSON.stringify(activeFeeds.map((f) => [f.id, f.url, f.color, f.name]))

  const [events, setEvents] = useState<CalendarEvent[]>([])
  const [errors, setErrors] = useState<Array<{ feedName: string; message: string }>>([])
  const [isLoading, setIsLoading] = useState(false)
  const [isRevalidating, setIsRevalidating] = useState(false)

  useEffect(() => {
    if (!enabled || activeFeeds.length === 0) {
      setEvents([])
      setErrors([])
      setIsLoading(false)
      return
    }

    let cancelled = false

    async function load() {
      // 1. Cache read (instant on warm path).
      const cachedResults = await Promise.all(
        activeFeeds.map((f) => getCachedEntry(f.url, dateString)),
      )
      if (cancelled) return

      const hasAnyCache = cachedResults.some((c) => c !== undefined)
      if (hasAnyCache) {
        const merged = mergeCachedResults(activeFeeds, cachedResults)
        setEvents(merged.events)
        setErrors(merged.errors)
        setIsLoading(false)
      } else {
        setIsLoading(true)
      }

      // 2. Background revalidate (always runs).
      setIsRevalidating(true)
      const freshResults = await Promise.all(activeFeeds.map((f) => fetchAndCache(f, dateString)))
      if (cancelled) return

      const merged = mergeFreshResults(freshResults)
      setEvents(merged.events)
      setErrors(merged.errors)
      setIsLoading(false)
      setIsRevalidating(false)

      // 3. Prefetch ±3 days (fire-and-forget, doesn't touch component state).
      // Skip if any feed failed — no point prefetching unreachable feeds.
      const hasErrors = freshResults.some((r) => r.error)
      if (!hasErrors) {
        void prefetchSurrounding(activeFeeds, dateString)
      }
    }

    void load()
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dateString, enabled, feedKey, focusTick])

  return { events, errors, isLoading, isRevalidating }
}
