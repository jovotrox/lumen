import ICAL from "ical.js"
import { isElectron } from "./electron"
import type { CalendarEvent } from "./calendar"

/**
 * Fetch an ICS/iCalendar feed and parse it into CalendarEvent objects.
 *
 * In Electron, uses the `electron:fetch` IPC channel to bypass CORS (public
 * calendar providers like iCloud/Google/Outlook don't always send CORS headers).
 * In browser/PWA, falls back to native fetch — users will need a CORS-enabled
 * provider or a proxy.
 */
export async function fetchIcsEvents(
  url: string,
  dateString: string,
  signal?: AbortSignal,
): Promise<CalendarEvent[]> {
  const icsText = await fetchIcsRaw(url, signal)
  return parseIcsForDate(icsText, dateString)
}

/**
 * Fetch raw ICS text from a URL. Uses Electron's CORS-free IPC in desktop,
 * browser fetch otherwise.
 */
export async function fetchIcsRaw(url: string, signal?: AbortSignal): Promise<string> {
  // Validate URL
  const parsed = new URL(url)
  if (
    parsed.protocol !== "https:" &&
    parsed.protocol !== "http:" &&
    parsed.protocol !== "webcal:"
  ) {
    throw new Error(`Invalid protocol: ${parsed.protocol}`)
  }
  // Normalize webcal:// to https://
  const httpUrl = parsed.protocol === "webcal:" ? url.replace(/^webcal:\/\//, "https://") : url

  // Electron: CORS-free IPC
  if (isElectron() && window.electronAPI?.fetch) {
    const response = await window.electronAPI.fetch({
      url: httpUrl,
      method: "GET",
      headers: { Accept: "text/calendar, */*" },
    })
    if (response.statusCode < 200 || response.statusCode >= 300) {
      throw new Error(`HTTP ${response.statusCode}: ${response.statusMessage}`)
    }
    return new TextDecoder().decode(response.body)
  }

  // Browser/PWA: route through CORS proxy if available
  const apiBase = import.meta.env.VITE_API_BASE_URL
  if (apiBase) {
    const target = new URL(httpUrl)
    const proxyUrl = `${apiBase}/cors-proxy/${target.host}${target.pathname}${target.search}`
    const response = await fetch(proxyUrl, {
      headers: { Accept: "text/calendar, */*" },
      signal,
    })
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`)
    }
    return response.text()
  }

  // Direct fetch fallback (localhost dev without Vercel proxy)
  const response = await fetch(httpUrl, {
    headers: { Accept: "text/calendar, */*" },
    signal,
  })
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`)
  }
  return response.text()
}

/**
 * Parse ICS text and return events occurring on the given date (YYYY-MM-DD).
 * Handles recurring events (RRULE) by expanding them within the day.
 *
 * Two key correctness details:
 * 1. `event.iterator()` must NOT receive a custom dtstart — ical.js uses it as the
 *    base time for ALL occurrences, which would override the event's actual time.
 *    Instead we iterate from the event's real DTSTART and fast-forward.
 * 2. Exception VEVENTs (with RECURRENCE-ID) must be related to their master event
 *    via `relateException()` so `getOccurrenceDetails()` returns the override.
 *    They must NOT be processed as standalone events (would cause duplicates).
 */
export function parseIcsForDate(icsText: string, dateString: string): CalendarEvent[] {
  // Validate response is actually ICS before feeding to parser —
  // CORS proxy may return HTML error pages that block the UI thread
  // when ICAL.parse tries to parse them synchronously.
  const trimmed = icsText.trimStart()
  if (!trimmed.startsWith("BEGIN:VCALENDAR")) {
    throw new Error("Response is not a valid iCalendar file")
  }

  const jcal = ICAL.parse(icsText)
  const comp = new ICAL.Component(jcal)
  const vevents = comp.getAllSubcomponents("vevent")

  // Day boundaries in local time
  const [year, month, day] = dateString.split("-").map(Number)
  const startOfDay = new Date(year, month - 1, day, 0, 0, 0, 0)
  const endOfDay = new Date(year, month - 1, day + 1, 0, 0, 0, 0)

  const startIcal = ICAL.Time.fromJSDate(startOfDay, false)
  const endIcal = ICAL.Time.fromJSDate(endOfDay, false)

  const results: CalendarEvent[] = []

  // Safety cap: prevent pathological RRULEs (e.g. DAILY since 2000 with no UNTIL)
  // from freezing the UI. 10000 covers ~27 years of daily events.
  const MAX_ITERATIONS = 10000

  // --- Phase 1: categorize VEVENTs ---
  // Master events have RRULE; exceptions have RECURRENCE-ID; the rest are standalone.
  const masterEvents: ICAL.Event[] = []
  const standaloneEvents: ICAL.Event[] = []
  const exceptionVevents: ICAL.Component[] = []

  for (const vevent of vevents) {
    if (vevent.getFirstPropertyValue("recurrence-id")) {
      exceptionVevents.push(vevent)
    } else {
      const event = new ICAL.Event(vevent)
      if (event.isRecurring()) {
        masterEvents.push(event)
      } else {
        standaloneEvents.push(event)
      }
    }
  }

  // --- Phase 2: relate exceptions to their masters ---
  for (const master of masterEvents) {
    for (const exVevent of exceptionVevents) {
      const uid = exVevent.getFirstPropertyValue("uid") as string
      if (uid === master.uid) {
        master.relateException(new ICAL.Event(exVevent))
      }
    }
  }

  // --- Phase 3: expand recurring events ---
  for (const master of masterEvents) {
    // Do NOT pass startIcal to iterator — it would replace the event's dtstart,
    // making all occurrences use midnight instead of the real event time.
    const iterator = master.iterator()
    let next = iterator.next()
    let iterations = 0

    // Fast-forward past occurrences before our target day.
    while (next && next.compare(startIcal) < 0 && iterations++ < MAX_ITERATIONS) {
      next = iterator.next()
    }

    // Process occurrences in [startIcal, endIcal).
    while (next && iterations++ < MAX_ITERATIONS) {
      if (next.compare(endIcal) >= 0) break
      const occurrence = master.getOccurrenceDetails(next)
      if (occurrence.endDate.compare(startIcal) > 0) {
        results.push(toCalendarEvent(master, occurrence.startDate, occurrence.endDate))
      }
      next = iterator.next()
    }
  }

  // --- Phase 4: add standalone (non-recurring, non-exception) events ---
  for (const event of standaloneEvents) {
    const eventStart = event.startDate
    const eventEnd = event.endDate
    if (eventEnd.compare(startIcal) > 0 && eventStart.compare(endIcal) < 0) {
      results.push(toCalendarEvent(event, eventStart, eventEnd))
    }
  }

  // Sort by start time
  results.sort((a, b) => a.start.localeCompare(b.start))
  return results
}

function toCalendarEvent(event: ICAL.Event, start: ICAL.Time, end: ICAL.Time): CalendarEvent {
  return {
    title: event.summary || "(untitled)",
    start: start.toJSDate().toISOString(),
    end: end.toJSDate().toISOString(),
    calendar: "", // ICS doesn't carry source calendar name for single-feed
    color: "#8b8b8b", // default; could be overridden from X-APPLE-CALENDAR-COLOR on the VCALENDAR
    isAllDay: start.isDate,
    location: event.location || undefined,
  }
}
