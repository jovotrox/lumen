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
    clear: vi.fn(() => {
      store.clear()
      return Promise.resolve()
    }),
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

describe("calendar-cache: clearCalendarCache", () => {
  test("clearCalendarCache removes all entries", async () => {
    await setCachedEntry("https://a.com/feed.ics", "2026-04-13", { events: [], fetchedAt: 0 })
    await setCachedEntry("https://b.com/feed.ics", "2026-04-14", { events: [], fetchedAt: 0 })
    await clearCalendarCache()
    expect([...memStore.keys()]).toHaveLength(0)
  })
})

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
