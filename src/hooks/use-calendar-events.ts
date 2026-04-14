import { atom, useAtomValue, useSetAtom } from "jotai"
import { useEffect, useState } from "react"
import { calendarFeedsAtom, calendarIntegrationAtom } from "../global-state"
import { getCachedEntry, setCachedEntry, type CachedEntry } from "../utils/calendar-cache"
import type { CalendarEvent, CalendarFeed } from "../utils/calendar"
import { fetchIcsEvents } from "../utils/calendar-ics"

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
    const rawEvents = await fetchIcsEvents(feed.url, dateString)
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
    }

    void load()
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dateString, enabled, feedKey, focusTick])

  return { events, errors, isLoading, isRevalidating }
}
