import { clear, createStore, del, get, keys, set } from "idb-keyval"
import type { CalendarEvent } from "./calendar"

const CACHE_VERSION = "v1"
const store = createStore("lumen-calendar-cache", "events")

export interface CachedEntry {
  /** Parsed events for this feed+date combo (already tagged with calendar/color). */
  events: CalendarEvent[]
  /** When this entry was last fetched (Date.now()). */
  fetchedAt: number
  /** If the last fetch failed, the error message (events will be []). */
  error?: string
}

function makeKey(feedUrl: string, dateString: string): string {
  return `${CACHE_VERSION}::${feedUrl}::${dateString}`
}

export async function getCachedEntry(
  feedUrl: string,
  dateString: string,
): Promise<CachedEntry | undefined> {
  return get(makeKey(feedUrl, dateString), store)
}

export async function setCachedEntry(
  feedUrl: string,
  dateString: string,
  entry: CachedEntry,
): Promise<void> {
  return set(makeKey(feedUrl, dateString), entry, store)
}

export async function clearCalendarCache(): Promise<void> {
  return clear(store)
}

export async function evictOutsideRange(
  validFeedUrls: Set<string>,
  minDate: string,
  maxDate: string,
): Promise<void> {
  const allKeys = (await keys(store)) as string[]
  const toDelete = allKeys.filter((key) => {
    const firstSep = key.indexOf("::")
    const lastSep = key.lastIndexOf("::")
    if (firstSep === -1 || firstSep === lastSep) return true // malformed key
    const version = key.slice(0, firstSep)
    const feedUrl = key.slice(firstSep + 2, lastSep)
    const date = key.slice(lastSep + 2)
    if (version !== CACHE_VERSION) return true // old shape
    if (!validFeedUrls.has(feedUrl)) return true // feed was removed
    if (date < minDate || date > maxDate) return true // outside window
    return false
  })
  await Promise.all(toDelete.map((k) => del(k, store)))
}
