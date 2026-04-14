# Calendar Caching + Prefetch + Animations Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the calendar event list in daily notes feel native — instant on day open (warm cache), instant on day-to-day navigation (±3 day prefetch), and animate when revalidate brings real changes.

**Architecture:** Stale-while-revalidate pattern. Three layers: persistence (`calendar-cache.ts` over `idb-keyval`), orchestration (`useCalendarEvents` hook with cache read + background revalidate + sliding prefetch window), and UI (`<CalendarEvents>` with `motion` + `AnimatePresence`).

**Tech Stack:** TypeScript, React, Jotai, idb-keyval (already in deps), motion/react (already in deps), Vitest.

**Spec:** [`docs/superpowers/specs/2026-04-13-calendar-caching-design.md`](../specs/2026-04-13-calendar-caching-design.md)

**Branch:** `feature/calendar-caching` (already created from `personal`)

---

## File Structure

| File                                 | Status | Responsibility                                                  |
| ------------------------------------ | ------ | --------------------------------------------------------------- |
| `src/utils/calendar-cache.ts`        | NEW    | IndexedDB key-value store; types; eviction                      |
| `src/utils/calendar-cache.test.ts`   | NEW    | Unit tests (mocked idb-keyval)                                  |
| `src/hooks/use-calendar-events.ts`   | NEW    | SWR orchestration + prefetch + focus invalidation               |
| `src/components/calendar-events.tsx` | MODIFY | Use hook + add motion animations; remove local fetch state      |
| `src/utils/calendar.ts`              | MODIFY | Remove in-memory cache + `invalidateCalendarCache` (after grep) |
| `src/global-state.ts`                | MODIFY | Remove `calendarRefreshTickAtom` (after grep)                   |
| `package.json`                       | MODIFY | Bump 0.6.0 → 0.7.0                                              |
| `CONTEXT.md`                         | MODIFY | Add v0.7.0 entry                                                |

No new dependencies. `idb-keyval`, `motion`, and `vitest` are already in `package.json`.

**Boundaries (locked in):**

- `calendar-cache.ts` knows nothing about feeds, fetches, or TTL — pure key-value store
- `use-calendar-events.ts` orchestrates fetch + cache + prefetch + invalidations
- `<CalendarEvents>` only renders + animates; receives data from the hook

---

## Task 1: Cache module — basic round-trip (TDD)

**Files:**

- Create: `src/utils/calendar-cache.ts`
- Create: `src/utils/calendar-cache.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/utils/calendar-cache.test.ts`:

```ts
import { beforeEach, describe, expect, test, vi } from "vitest"

// Mock idb-keyval with an in-memory Map. We expose the store via __store
// for test-only manipulation (injecting old-version keys, asserting state).
vi.mock("idb-keyval", () => {
  const store = new Map<string, unknown>()
  return {
    createStore: vi.fn(() => ({})),
    get: vi.fn((key: string) => Promise.resolve(store.get(key))),
    set: vi.fn((key: string, value: unknown) => {
      store.set(key, value)
      return Promise.resolve()
    }),
    del: vi.fn((key: string) => {
      store.delete(key)
      return Promise.resolve()
    }),
    keys: vi.fn(() => Promise.resolve([...store.keys()])),
    __store: store,
  }
})

import * as idb from "idb-keyval"
import {
  CachedEntry,
  clearCalendarCache,
  evictOutsideRange,
  getCachedEntry,
  setCachedEntry,
} from "./calendar-cache"

const memStore = (idb as unknown as { __store: Map<string, unknown> }).__store

beforeEach(() => {
  memStore.clear()
})

describe("calendar-cache: round-trip", () => {
  test("setCachedEntry then getCachedEntry returns the same entry", async () => {
    const url = "https://cal.example.com/feed.ics"
    const date = "2026-04-13"
    const entry: CachedEntry = {
      events: [
        {
          title: "Standup",
          start: "2026-04-13T09:00:00.000Z",
          end: "2026-04-13T09:30:00.000Z",
          calendar: "Work",
          color: "#FF3B30",
          isAllDay: false,
        },
      ],
      fetchedAt: 1234567890,
    }
    await setCachedEntry(url, date, entry)
    const got = await getCachedEntry(url, date)
    expect(got).toEqual(entry)
  })

  test("getCachedEntry returns undefined for missing key", async () => {
    const got = await getCachedEntry("https://nope.com/feed.ics", "2026-04-13")
    expect(got).toBeUndefined()
  })

  test("setCachedEntry uses CACHE_VERSION-prefixed key", async () => {
    await setCachedEntry("https://cal.example.com/feed.ics", "2026-04-13", {
      events: [],
      fetchedAt: 0,
    })
    const keys = [...memStore.keys()]
    expect(keys).toHaveLength(1)
    expect(keys[0]).toMatch(/^v1::https:\/\/cal\.example\.com\/feed\.ics::2026-04-13$/)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/utils/calendar-cache.test.ts`
Expected: FAIL — `Cannot find module './calendar-cache'`

- [ ] **Step 3: Write minimal implementation**

Create `src/utils/calendar-cache.ts`:

```ts
import { createStore, del, get, keys, set } from "idb-keyval"
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
  const allKeys = await keys(store)
  await Promise.all(allKeys.map((k) => del(k, store)))
}

export async function evictOutsideRange(
  validFeedUrls: Set<string>,
  minDate: string,
  maxDate: string,
): Promise<void> {
  // Stub for Task 2 — exists so the test file compiles.
  void validFeedUrls
  void minDate
  void maxDate
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- src/utils/calendar-cache.test.ts`
Expected: PASS — 3/3 tests in the "round-trip" describe block.

- [ ] **Step 5: Commit**

```bash
git add src/utils/calendar-cache.ts src/utils/calendar-cache.test.ts
git commit -m "feat(calendar): IndexedDB cache module with round-trip"
```

---

## Task 2: Cache module — `evictOutsideRange` (TDD)

**Files:**

- Modify: `src/utils/calendar-cache.ts`
- Modify: `src/utils/calendar-cache.test.ts`

- [ ] **Step 1: Add failing tests**

Append to `src/utils/calendar-cache.test.ts`:

```ts
describe("calendar-cache: evictOutsideRange", () => {
  test("removes entries from feeds no longer in validFeedUrls", async () => {
    await setCachedEntry("https://kept.com/feed.ics", "2026-04-13", {
      events: [],
      fetchedAt: 0,
    })
    await setCachedEntry("https://removed.com/feed.ics", "2026-04-13", {
      events: [],
      fetchedAt: 0,
    })

    await evictOutsideRange(new Set(["https://kept.com/feed.ics"]), "2026-04-10", "2026-04-16")

    expect(await getCachedEntry("https://kept.com/feed.ics", "2026-04-13")).toBeDefined()
    expect(await getCachedEntry("https://removed.com/feed.ics", "2026-04-13")).toBeUndefined()
  })

  test("removes entries with dates outside [minDate, maxDate]", async () => {
    const url = "https://feed.com/x.ics"
    await setCachedEntry(url, "2026-04-09", { events: [], fetchedAt: 0 }) // before minDate
    await setCachedEntry(url, "2026-04-10", { events: [], fetchedAt: 0 }) // boundary in
    await setCachedEntry(url, "2026-04-13", { events: [], fetchedAt: 0 }) // in range
    await setCachedEntry(url, "2026-04-16", { events: [], fetchedAt: 0 }) // boundary in
    await setCachedEntry(url, "2026-04-17", { events: [], fetchedAt: 0 }) // after maxDate

    await evictOutsideRange(new Set([url]), "2026-04-10", "2026-04-16")

    expect(await getCachedEntry(url, "2026-04-09")).toBeUndefined()
    expect(await getCachedEntry(url, "2026-04-10")).toBeDefined()
    expect(await getCachedEntry(url, "2026-04-13")).toBeDefined()
    expect(await getCachedEntry(url, "2026-04-16")).toBeDefined()
    expect(await getCachedEntry(url, "2026-04-17")).toBeUndefined()
  })

  test("removes entries with mismatched CACHE_VERSION", async () => {
    const url = "https://feed.com/x.ics"
    // Inject an old-version key directly into the mock store
    memStore.set(`v0::${url}::2026-04-13`, { events: [], fetchedAt: 0 })
    await setCachedEntry(url, "2026-04-13", { events: [], fetchedAt: 0 })

    await evictOutsideRange(new Set([url]), "2026-04-10", "2026-04-16")

    // Old version should be gone
    expect(memStore.has(`v0::${url}::2026-04-13`)).toBe(false)
    // Current version should remain
    expect(await getCachedEntry(url, "2026-04-13")).toBeDefined()
  })

  test("does not touch unrelated valid keys", async () => {
    await setCachedEntry("https://a.com/x.ics", "2026-04-13", { events: [], fetchedAt: 0 })
    await setCachedEntry("https://b.com/x.ics", "2026-04-14", { events: [], fetchedAt: 0 })

    await evictOutsideRange(
      new Set(["https://a.com/x.ics", "https://b.com/x.ics"]),
      "2026-04-10",
      "2026-04-16",
    )

    expect(await getCachedEntry("https://a.com/x.ics", "2026-04-13")).toBeDefined()
    expect(await getCachedEntry("https://b.com/x.ics", "2026-04-14")).toBeDefined()
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- src/utils/calendar-cache.test.ts`
Expected: FAIL — the four eviction tests fail because the stub does nothing.

- [ ] **Step 3: Implement `evictOutsideRange`**

Replace the stub in `src/utils/calendar-cache.ts`:

```ts
export async function evictOutsideRange(
  validFeedUrls: Set<string>,
  minDate: string,
  maxDate: string,
): Promise<void> {
  const allKeys = (await keys(store)) as string[]
  const toDelete = allKeys.filter((key) => {
    const [version, feedUrl, date] = key.split("::")
    if (version !== CACHE_VERSION) return true // old shape
    if (!validFeedUrls.has(feedUrl)) return true // feed was removed
    if (date < minDate || date > maxDate) return true // outside window
    return false
  })
  await Promise.all(toDelete.map((k) => del(k, store)))
}
```

Note: `feedUrl` from `split("::")` works because `https://` only contains one `:` (and no `::`). The two-colon separator is unambiguous.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- src/utils/calendar-cache.test.ts`
Expected: PASS — 7/7 tests across both describe blocks.

- [ ] **Step 5: Commit**

```bash
git add src/utils/calendar-cache.ts src/utils/calendar-cache.test.ts
git commit -m "feat(calendar): evictOutsideRange handles version, feed, and date filters"
```

---

## Task 3: Cache module — `clearCalendarCache` (TDD)

**Files:**

- Modify: `src/utils/calendar-cache.test.ts` (impl already exists from Task 1)

- [ ] **Step 1: Add failing test**

Append to `src/utils/calendar-cache.test.ts`:

```ts
describe("calendar-cache: clearCalendarCache", () => {
  test("removes every entry in the namespace", async () => {
    await setCachedEntry("https://a.com/x.ics", "2026-04-13", { events: [], fetchedAt: 0 })
    await setCachedEntry("https://b.com/x.ics", "2026-04-14", { events: [], fetchedAt: 0 })
    expect(memStore.size).toBe(2)

    await clearCalendarCache()

    expect(memStore.size).toBe(0)
  })
})
```

- [ ] **Step 2: Run test to verify it passes**

Run: `npm test -- src/utils/calendar-cache.test.ts`
Expected: PASS — `clearCalendarCache` was implemented in Task 1, this test confirms it.

- [ ] **Step 3: Commit**

```bash
git add src/utils/calendar-cache.test.ts
git commit -m "test(calendar): clearCalendarCache removes all entries"
```

---

## Task 4: Hook scaffold — types, atom, and stub return

**Files:**

- Create: `src/hooks/use-calendar-events.ts`

- [ ] **Step 1: Create the hook file with the bare minimum (focus atom + types + stub)**

Create `src/hooks/use-calendar-events.ts`. Only import what's used in this task — Tasks 5 and 6 add the rest.

```ts
import { atom, useAtomValue, useSetAtom } from "jotai"
import { useEffect, useState } from "react"
import type { CalendarEvent } from "../utils/calendar"

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

export function useCalendarEvents(_dateString: string): UseCalendarEventsResult {
  // Stub — Task 5 wires the SWR logic.
  useFocusInvalidationTick()
  const [events] = useState<CalendarEvent[]>([])
  const [errors] = useState<Array<{ feedName: string; message: string }>>([])
  const [isLoading] = useState(false)
  const [isRevalidating] = useState(false)
  return { events, errors, isLoading, isRevalidating }
}
```

- [ ] **Step 2: Verify lint + typecheck pass**

Run: `npm run lint -- src/hooks/use-calendar-events.ts`
Run: `npx tsc --noEmit`
Expected: both PASS with no errors and no warnings. The unused `_dateString` parameter is allowed by Lumen's ESLint config (underscore prefix convention).

- [ ] **Step 3: Commit**

```bash
git add src/hooks/use-calendar-events.ts
git commit -m "feat(calendar): scaffold useCalendarEvents hook"
```

---

## Task 5: Hook — cache read + background revalidate (no prefetch yet)

**Files:**

- Modify: `src/hooks/use-calendar-events.ts`

- [ ] **Step 1: Expand imports and add helper functions for fetch and merge**

Update the import block at the top of `src/hooks/use-calendar-events.ts` to:

```ts
import { atom, useAtomValue, useSetAtom } from "jotai"
import { useEffect, useState } from "react"
import { calendarFeedsAtom, calendarIntegrationAtom } from "../global-state"
import { getCachedEntry, setCachedEntry, type CachedEntry } from "../utils/calendar-cache"
import type { CalendarEvent, CalendarFeed } from "../utils/calendar"
import { fetchIcsEvents } from "../utils/calendar-ics"
```

Then append these helpers ABOVE the `useCalendarEvents` export:

```ts
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
```

- [ ] **Step 2: Replace `useCalendarEvents` body with SWR logic**

Replace the existing `useCalendarEvents` with:

```ts
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
```

The `eslint-disable-next-line` is intentional — `activeFeeds` is recomputed every render so depending on it would be an infinite loop. `feedKey` (a stable JSON string) is the correct dep.

- [ ] **Step 3: Verify lint + typecheck pass**

Run: `npm run lint -- src/hooks/use-calendar-events.ts`
Run: `npx tsc --noEmit`
Expected: PASS. The unused imports from Task 4 (`evictOutsideRange`, `PREFETCH_RADIUS_DAYS`, `PREFETCH_FRESH_MS`) are still unused — they get wired in Task 6.

- [ ] **Step 4: Commit**

```bash
git add src/hooks/use-calendar-events.ts
git commit -m "feat(calendar): hook reads cache + revalidates in background"
```

---

## Task 6: Hook — prefetch ±3 days + eviction

**Files:**

- Modify: `src/hooks/use-calendar-events.ts`

- [ ] **Step 1: Add prefetch constants, import `evictOutsideRange`, and helpers**

Add `evictOutsideRange` to the import from `../utils/calendar-cache`:

```ts
import {
  evictOutsideRange,
  getCachedEntry,
  setCachedEntry,
  type CachedEntry,
} from "../utils/calendar-cache"
```

Add the prefetch constants near the top of the file (after the imports, before `UseCalendarEventsResult`):

```ts
const PREFETCH_RADIUS_DAYS = 3
const PREFETCH_FRESH_MS = 5 * 60_000
```

Then insert these helpers AFTER `fetchAndCache` (before `sortEvents`) in `src/hooks/use-calendar-events.ts`:

```ts
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
  for (const date of dates) {
    await Promise.all(feeds.map((f) => fetchAndCacheIfStale(f, date)))
  }
  const validUrls = new Set(feeds.map((f) => f.url))
  await evictOutsideRange(validUrls, dates[0], dates[dates.length - 1])
}
```

- [ ] **Step 2: Wire prefetch into `useCalendarEvents`**

Inside the `load()` function in `useCalendarEvents`, AFTER the `setIsRevalidating(false)` line, add:

```ts
// 3. Prefetch ±3 days (fire-and-forget, doesn't touch component state).
void prefetchSurrounding(activeFeeds, dateString)
```

The full `load()` should now have three numbered sections (cache read, revalidate, prefetch).

- [ ] **Step 3: Verify lint + typecheck pass**

Run: `npm run lint -- src/hooks/use-calendar-events.ts`
Run: `npx tsc --noEmit`
Expected: PASS. All previously-unused imports are now used.

- [ ] **Step 4: Commit**

```bash
git add src/hooks/use-calendar-events.ts
git commit -m "feat(calendar): prefetch ±3 days + evict outside window"
```

---

## Task 7: Component refactor — wire hook + add motion animations

**Files:**

- Modify: `src/components/calendar-events.tsx`

- [ ] **Step 1: Read the current implementation**

Read `src/components/calendar-events.tsx` end-to-end. Note the local state (`events`, `errors`, `loading`), the focus listener `useEffect`, and the `calendarRefreshTickAtom` usage — all of these get removed.

- [ ] **Step 2: Replace the file with the hook-driven, motion-animated version**

Replace `src/components/calendar-events.tsx` entirely with:

```tsx
import { useNavigate } from "@tanstack/react-router"
import { useAtomValue, useSetAtom } from "jotai"
import { Calendar, FileText } from "lucide-react"
import { AnimatePresence, motion } from "motion/react"
import React from "react"
import {
  calendarFeedsAtom,
  calendarIntegrationAtom,
  globalStateMachineAtom,
  notesAtom,
} from "../global-state"
import { useCalendarEvents } from "../hooks/use-calendar-events"
import { CalendarEvent } from "../utils/calendar"
import { Skeleton } from "./skeleton"

/** Format an event's start time as HH:MM (24h), or "All day" for all-day events. */
function formatStartTime(event: CalendarEvent): string {
  if (event.isAllDay) return "All day"
  const d = new Date(event.start)
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: false })
}

/**
 * Build a stable, human-readable note ID from an event.
 * Format: event-YYYY-MM-DD-HHMM-slug (timed) or event-YYYY-MM-DD-allday-slug (all-day).
 *
 * Including the time disambiguates multiple events with the same title on the
 * same day (e.g., two feeds both have "Standup" at different times).
 */
function getEventNoteId(event: CalendarEvent): string {
  const date = event.start.slice(0, 10)
  const timePart = event.isAllDay ? "allday" : event.start.slice(11, 16).replace(":", "")
  const slug = event.title
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40)
  return `event-${date}-${timePart}-${slug || "untitled"}`
}

function buildEventNoteContent(event: CalendarEvent): string {
  const lines = [
    "---",
    "tags: [event, calendar]",
    "event:",
    `  title: ${JSON.stringify(event.title)}`,
    `  start: "${event.start}"`,
    `  end: "${event.end}"`,
    event.calendar ? `  calendar: ${JSON.stringify(event.calendar)}` : "",
    event.location ? `  location: ${JSON.stringify(event.location)}` : "",
    `  isAllDay: ${event.isAllDay}`,
    "---",
    "",
    `# ${event.title}`,
    "",
  ].filter(Boolean)
  return lines.join("\n")
}

export function CalendarEvents({ dateString }: { dateString: string }) {
  const enabled = useAtomValue(calendarIntegrationAtom)
  const feeds = useAtomValue(calendarFeedsAtom)
  const notes = useAtomValue(notesAtom)
  const send = useSetAtom(globalStateMachineAtom)
  const navigate = useNavigate()
  const { events, errors, isLoading } = useCalendarEvents(dateString)

  const activeFeeds = feeds.filter((f) => f.enabled && f.url)

  const openEventNote = (event: CalendarEvent) => {
    const noteId = getEventNoteId(event)
    const exists = notes.has(noteId)

    if (!exists) {
      const content = buildEventNoteContent(event)
      send({
        type: "WRITE_FILES",
        markdownFiles: { [`${noteId}.md`]: content },
        commitMessage: `Create linked note for event "${event.title}"`,
      })
    }

    navigate({
      to: "/notes/$",
      params: { _splat: noteId },
      search: { mode: exists ? "read" : "write", query: undefined, view: "grid" },
    })
  }

  if (!enabled) return null

  if (activeFeeds.length === 0) {
    return (
      <div className="my-2 flex items-center gap-2 rounded-lg bg-bg-secondary px-3 py-2 text-sm text-text-tertiary">
        <Calendar className="size-3 opacity-60" />
        <span>No calendars configured. Add one in Settings.</span>
      </div>
    )
  }

  // Cold start with no cache yet — render skeleton rows for stable rhythm.
  if (isLoading && events.length === 0) {
    return (
      <div className="my-2 flex flex-col gap-0 rounded-lg bg-bg-secondary p-1">
        {[0, 1, 2].map((i) => (
          <div key={i} className="flex items-center gap-2 px-2.5 py-1">
            <Skeleton className="h-3 w-10 shrink-0" />
            <Skeleton className={i === 1 ? "h-3 w-40" : i === 0 ? "h-3 w-56" : "h-3 w-32"} />
          </div>
        ))}
      </div>
    )
  }

  if (events.length === 0 && errors.length === 0) return null

  return (
    <motion.div layout className="my-2 flex flex-col gap-0 rounded-lg bg-bg-secondary p-1">
      <AnimatePresence mode="popLayout" initial={false}>
        {events.map((event) => {
          const noteId = getEventNoteId(event)
          const hasNote = notes.has(noteId)
          return (
            <motion.button
              key={noteId}
              layout
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.12, ease: "easeOut" }}
              type="button"
              onClick={() => openEventNote(event)}
              className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1 text-left transition-colors hover:bg-bg-tertiary active:bg-bg-tertiary focus-visible:bg-bg-tertiary focus:outline-none"
              title={
                event.calendar
                  ? `${event.calendar} — ${hasNote ? "open linked note" : "create linked note"}`
                  : undefined
              }
            >
              <span
                className="shrink-0 text-sm font-medium tabular-nums"
                style={{ color: event.color }}
              >
                {formatStartTime(event)}
              </span>
              <span className="flex-1 truncate text-sm text-text">{event.title}</span>
              {hasNote ? (
                <FileText
                  className="size-3 shrink-0 text-text-tertiary"
                  aria-label="Has linked note"
                />
              ) : null}
            </motion.button>
          )
        })}
      </AnimatePresence>
      {errors.length > 0 ? (
        <div className="mt-1 flex flex-col gap-0.5 px-2 text-[10px] text-text-tertiary">
          {errors.map((e, i) => (
            <span key={i}>
              ⚠ {e.feedName}: {e.message}
            </span>
          ))}
        </div>
      ) : null}
    </motion.div>
  )
}
```

Note the removed pieces: `calendarRefreshTickAtom`, `fetchAllFeedsEvents`, `invalidateCalendarCache`, the local `useState` for events/errors/loading, the focus `useEffect`, and the data-fetching `useEffect`. The `React` import stays for the JSX runtime.

- [ ] **Step 3: Verify build + lint pass**

Run: `npm run lint -- src/components/calendar-events.tsx`
Run: `npx tsc --noEmit`
Expected: both PASS.

- [ ] **Step 4: Manual smoke test**

Run: `npm run electron:build-main && npm run electron:dev`
Open a daily note (e.g., today). Expected:

- Events render (cold path → skeleton → events fade in once)
- Navigate to yesterday and back — appears instant after first prefetch
- Alt-tab away and back — events do not blank or flicker

Stop the dev session.

- [ ] **Step 5: Commit**

```bash
git add src/components/calendar-events.tsx
git commit -m "feat(calendar): wire hook + add motion fade/layout animations"
```

---

## Task 8: Cleanup — remove dead code from `calendar.ts` and `global-state.ts`

**Files:**

- Modify: `src/utils/calendar.ts`
- Modify: `src/global-state.ts`

- [ ] **Step 1: Verify nothing else uses the old in-memory cache or refresh tick**

Run these checks (use Grep tool, not bash). Each should return zero or only the original definition site:

- `invalidateCalendarCache` (expect: only the export in `calendar.ts`)
- `calendarRefreshTickAtom` (expect: only the definition in `global-state.ts`)
- `fetchAllFeedsEvents` (expect: only the definition in `calendar.ts`)
- `fetchFeedEvents` (expect: only the definition in `calendar.ts`)

If any of these have other consumers (outside the four files we touched), STOP and ask the user — there's an unexpected dependency.

- [ ] **Step 2: Remove the in-memory cache + dead exports from `src/utils/calendar.ts`**

Open `src/utils/calendar.ts`. Delete:

1. The `import { fetchIcsEvents } from "./calendar-ics"` line at the top — it becomes unused.
2. The `cache`, `SUCCESS_TTL`, and `ERROR_TTL` module-level constants/variables.
3. The `fetchFeedEvents` function (entire export).
4. The `fetchAllFeedsEvents` function (entire export).
5. The `invalidateCalendarCache` function (entire export).

Keep: `CalendarFeed`, `CalendarEvent`, `FeedFetchResult`, and `FEED_COLORS`.

After the edit, `calendar.ts` should be just type definitions and the `FEED_COLORS` constant.

If `FeedFetchResult` is also unused after removal (Step 1 should have shown this), remove it too. Check with Grep: `FeedFetchResult` should only appear in `calendar.ts` itself.

- [ ] **Step 3: Remove `calendarRefreshTickAtom` from `src/global-state.ts`**

Use Grep to find the exact lines defining `calendarRefreshTickAtom` in `src/global-state.ts`. Delete the definition and any associated comment.

- [ ] **Step 4: Verify build + lint pass**

Run: `npm run lint`
Run: `npx tsc --noEmit`
Run: `npm test`
Expected: all PASS.

- [ ] **Step 5: Commit**

```bash
git add src/utils/calendar.ts src/global-state.ts
git commit -m "refactor(calendar): remove in-memory cache + refresh tick (replaced by hook)"
```

---

## Task 9: Manual end-to-end verification

**Files:** none (verification only)

- [ ] **Step 1: Build and launch Electron**

Run: `npm run electron:build-main && npm run electron:dev`

- [ ] **Step 2: Run the 8 manual scenarios from the spec**

Open DevTools (Cmd+Opt+I) for cache inspection. Walk through each scenario and tick it off:

- [ ] **Cold start sin cache**: Application > Storage > IndexedDB > delete `lumen-calendar-cache`. Reload. Open today's daily note. Expected: skeleton briefly, then events appear without an extra fade (cold start path).
- [ ] **Warm navigation**: From today, navigate to tomorrow, then yesterday, then +3 days quickly. Expected: each appears instant (cache hit from prefetch).
- [ ] **Window focus revalidate**: Alt-tab away from Lumen and back. Expected: visible events do not blank or flicker. If you change an event in Calendar.app meanwhile, it animates in/out on focus.
- [ ] **Day random fuera de ventana**: Navigate via URL to `/notes/2026-08-15`. Expected: cold fetch (skeleton); within ~1s, surrounding ±3 days are prefetched. Navigate to `/notes/2026-08-16` — instant.
- [ ] **Feed roto**: In Settings, edit a feed URL to `https://invalid-domain-test.example/feed.ics`. Open today. Expected: error inline, no spam of retries within 5 min.
- [ ] **Eventos cambiando**: Add an event in macOS Calendar.app for today. Alt-tab to Lumen. Expected: new event fades in (120ms).
- [ ] **Eviction**: Navigate to 30 distinct days (use the URL bar). After settling, inspect IndexedDB > `lumen-calendar-cache` > `events`. Expected: roughly `7 × <num-active-feeds>` keys, not 30+.
- [ ] **Reload de la app**: Cmd+R reload. Expected: today's daily note shows events instant from IndexedDB cache, no skeleton flicker.

If any scenario fails, STOP and debug before continuing.

- [ ] **Step 3: Stop the dev session**

---

## Task 10: Version bump + CONTEXT.md + final checks

**Files:**

- Modify: `package.json`
- Modify: `CONTEXT.md`

- [ ] **Step 1: Bump version**

Edit `package.json`. Change the `version` field from `"0.6.0"` to `"0.7.0"`.

If `package.json` already shows a version greater than 0.6.0 (e.g., breadcrumbs PR#6 already merged with a different bump), use the next MINOR after the current value.

- [ ] **Step 2: Add CONTEXT.md entry**

Open `CONTEXT.md`. Find the "Historial de Cambios Importantes" section. Add a new entry at the top of that section (most recent first):

```markdown
### v0.7.0 — 2026-04-13

- feat(calendar): persistent IndexedDB cache for ICS feeds (per-feed, per-day key)
- feat(calendar): stale-while-revalidate — daily notes show cached events instant, refetch in background
- feat(calendar): prefetch ±3 days around the current daily note for instant navigation
- feat(calendar): subtle 120ms fade + layout animations when events appear/disappear/change
- refactor(calendar): replace in-memory cache + `calendarRefreshTickAtom` with `useCalendarEvents` hook
```

Also update the top-of-file fields:

- `Última actualización` → `2026-04-13` (or current absolute date)
- `Versión` → `0.7.0`
- `Estado actual` → reflect the new feature

- [ ] **Step 3: Run full validation**

```bash
npm run lint
npm run build
npm test
```

Expected: all three exit 0.

- [ ] **Step 4: Commit**

```bash
git add package.json CONTEXT.md
git commit -m "chore: bump version to 0.7.0 + CONTEXT.md entry"
```

- [ ] **Step 5: Code review**

Per the `create-pr` skill, dispatch the code reviewer agent BEFORE opening the PR:

```
Agent(
  description: "Code review feature/calendar-caching",
  subagent_type: "superpowers:code-reviewer",
  prompt: "Review feature/calendar-caching vs personal.

  Scope: Calendar event list in daily notes. Three goals (one PR):
  - Persistent IndexedDB cache (was in-memory only)
  - Stale-while-revalidate pattern with ±3 day prefetch
  - Subtle motion animations (120ms fade + layout)

  Get the diff: git diff personal..HEAD, git log personal..HEAD --oneline.
  Read the actual files — don't rely on the diff alone.
  Spec: docs/superpowers/specs/2026-04-13-calendar-caching-design.md.

  Focus areas:
  - Correctness: SWR race conditions in useCalendarEvents (cancelled flag, focus tick, day-change spam)
  - Memory: IndexedDB key growth — does evictOutsideRange actually keep the cache bounded?
  - Edge cases: feed removed, feed renamed, daily note out of window, DST boundaries in surroundingDates
  - Animation: AnimatePresence + layout — any flicker on day-change with stable noteId keys?
  - Cleanup: dead code grep — is calendarRefreshTickAtom truly gone? fetchFeedEvents/fetchAllFeedsEvents truly unused?
  - Codebase consistency: file structure, jotai patterns, motion patterns vs other components

  Output: Blockers / Important / Nits / Strengths. Under 800 words, no preamble."
)
```

Address Blockers and Important findings. Document any deferred Nits in the PR body.

- [ ] **Step 6: Open PR**

After user confirmation:

```bash
git push -u origin feature/calendar-caching
gh pr create --base personal --head feature/calendar-caching \
  --title "feat: calendar caching + prefetch + animations (v0.7.0)" \
  --body "$(cat <<'EOF'
## Summary

- Persistent IndexedDB cache for ICS feeds — daily notes show events instant on app reload
- Stale-while-revalidate + prefetch ±3 days — day-to-day navigation is instant within the window
- Subtle 120ms fade + layout animations — events appear/disappear/reorder smoothly when revalidate brings real changes

## Test plan

- [ ] Cold start (delete IndexedDB) → skeleton → events
- [ ] Warm navigation (today → tomorrow → yesterday) is instant
- [ ] Alt-tab away and back: no flicker, animated diffs if events changed
- [ ] Day far in the future is cold-fetched, surrounding ±3 days then prefetched
- [ ] Broken feed URL: inline error, no retry spam
- [ ] App reload: today renders instant from IndexedDB
- [ ] After 30 distinct days visited, cache holds ~7 × N feed keys (not 30+)

Spec: [docs/superpowers/specs/2026-04-13-calendar-caching-design.md](docs/superpowers/specs/2026-04-13-calendar-caching-design.md)
EOF
)"
```

Capture the PR URL and report it to the user. Wait for review + squash merge. The `electron-release.yml` workflow auto-creates the v0.7.0 tag and GitHub Release on merge — no manual tagging needed.

---

## Notes for the executor

- **Branch is already created** (`feature/calendar-caching` from `personal`). Do not switch branches.
- **Spec is committed** at `docs/superpowers/specs/2026-04-13-calendar-caching-design.md` — read it if any task is ambiguous.
- **No new dependencies** — `idb-keyval` and `motion` are already in `package.json`.
- **Pre-commit hook** runs prettier + eslint --fix on staged files automatically. If it modifies files during commit, the commit succeeds with the formatted versions.
- **TDD discipline:** Tasks 1-3 are strict TDD (red → green → commit). Tasks 4-7 are not testable in isolation (React hooks + browser APIs); rely on lint, typecheck, and the manual verification in Task 9.
- **Do not skip Task 9** — manual end-to-end is the only check that catches animation regressions, cache eviction bugs, and prefetch race conditions.
- **If `electron:dev` fails to launch**, run `npm run electron:build-main` first to rebuild the main process bundle.
