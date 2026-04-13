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
export async function fetchIcsEvents(url: string, dateString: string): Promise<CalendarEvent[]> {
  const icsText = await fetchIcsRaw(url)
  return parseIcsForDate(icsText, dateString)
}

/**
 * Fetch raw ICS text from a URL. Uses Electron's CORS-free IPC in desktop,
 * browser fetch otherwise.
 */
export async function fetchIcsRaw(url: string): Promise<string> {
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

  // Browser fallback
  const response = await fetch(httpUrl, { headers: { Accept: "text/calendar, */*" } })
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`)
  }
  return response.text()
}

/**
 * Parse ICS text and return events occurring on the given date (YYYY-MM-DD).
 * Handles recurring events (RRULE) by expanding them within the day.
 */
export function parseIcsForDate(icsText: string, dateString: string): CalendarEvent[] {
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
  // from freezing the UI. 1000 is way more than any sane day should have.
  const MAX_OCCURRENCES_PER_EVENT = 1000

  for (const vevent of vevents) {
    const event = new ICAL.Event(vevent)
    if (event.isRecurring()) {
      // Seed iterator at startIcal so ical.js can fast-forward past historical
      // occurrences instead of iterating from DTSTART year-by-year.
      const iterator = event.iterator(startIcal)
      let next = iterator.next()
      let iterations = 0
      while (next && iterations++ < MAX_OCCURRENCES_PER_EVENT) {
        if (next.compare(endIcal) >= 0) break
        const occurrence = event.getOccurrenceDetails(next)
        if (occurrence.endDate.compare(startIcal) > 0) {
          results.push(toCalendarEvent(event, occurrence.startDate, occurrence.endDate))
        }
        next = iterator.next()
      }
    } else {
      const eventStart = event.startDate
      const eventEnd = event.endDate
      // Include if event overlaps with the day
      if (eventEnd.compare(startIcal) > 0 && eventStart.compare(endIcal) < 0) {
        results.push(toCalendarEvent(event, eventStart, eventEnd))
      }
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
