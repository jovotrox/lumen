import { useAtomValue, useSetAtom } from "jotai"
import { Calendar, Clock, FileText } from "lucide-react"
import React from "react"
import { useNavigate } from "@tanstack/react-router"
import {
  calendarFeedsAtom,
  calendarIntegrationAtom,
  calendarRefreshTickAtom,
  globalStateMachineAtom,
  notesAtom,
} from "../global-state"
import {
  CalendarEvent,
  fetchAllFeedsEvents,
  formatEventTime,
  invalidateCalendarCache,
} from "../utils/calendar"

/**
 * Build a stable, human-readable note ID from an event.
 * Format: event-YYYY-MM-DD-slugified-title (max ~80 chars)
 * Same event → same ID across runs, so click always resolves to the same note.
 */
function getEventNoteId(event: CalendarEvent): string {
  const date = event.start.slice(0, 10) // YYYY-MM-DD from ISO
  const slug = event.title
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // strip diacritics
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40)
  return `event-${date}-${slug || "untitled"}`
}

function buildEventNoteContent(event: CalendarEvent): string {
  const frontmatterLines = [
    "---",
    `event:`,
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
  return frontmatterLines.join("\n")
}

export function CalendarEvents({ dateString }: { dateString: string }) {
  const enabled = useAtomValue(calendarIntegrationAtom)
  const feeds = useAtomValue(calendarFeedsAtom)
  const refreshTick = useAtomValue(calendarRefreshTickAtom)
  const setRefreshTick = useSetAtom(calendarRefreshTickAtom)
  const notes = useAtomValue(notesAtom)
  const send = useSetAtom(globalStateMachineAtom)
  const navigate = useNavigate()
  const [events, setEvents] = React.useState<CalendarEvent[]>([])
  const [errors, setErrors] = React.useState<Array<{ feedName: string; message: string }>>([])
  const [loading, setLoading] = React.useState(false)

  const activeFeeds = feeds.filter((f) => f.enabled && f.url)
  const feedKey = JSON.stringify(activeFeeds.map((f) => [f.id, f.url, f.color, f.name]))

  // Re-fetch when the user brings the window back into focus (they might have
  // added events in their calendar app while we were in the background).
  React.useEffect(() => {
    const onFocus = () => {
      invalidateCalendarCache()
      setRefreshTick((t) => t + 1)
    }
    window.addEventListener("focus", onFocus)
    return () => window.removeEventListener("focus", onFocus)
  }, [setRefreshTick])

  React.useEffect(() => {
    if (!enabled || activeFeeds.length === 0) {
      setEvents([])
      setErrors([])
      setLoading(false)
      return
    }

    setLoading(true)
    fetchAllFeedsEvents(activeFeeds, dateString)
      .then(({ events, errors }) => {
        setEvents(events)
        setErrors(errors)
      })
      .finally(() => setLoading(false))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dateString, enabled, feedKey, refreshTick])

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
      <div className="flex items-center gap-2 px-4 py-2 text-xs text-text-tertiary">
        <Calendar className="size-3 opacity-60" />
        <span>No calendars configured. Add one in Settings.</span>
      </div>
    )
  }
  if (loading && events.length === 0) return null
  if (events.length === 0 && errors.length === 0) return null

  return (
    <div className="flex flex-col gap-1 px-4 py-2">
      {events.map((event, i) => {
        const noteId = getEventNoteId(event)
        const hasNote = notes.has(noteId)
        return (
          <button
            key={`${noteId}-${i}`}
            type="button"
            onClick={() => openEventNote(event)}
            className="group flex items-center gap-2 rounded px-2 py-1 text-left text-xs text-text-secondary transition hover:bg-bg-secondary focus:bg-bg-secondary focus:outline-none"
            title={event.calendar ? `${event.calendar} — click to open linked note` : undefined}
          >
            <div
              className="h-3 w-0.5 shrink-0 rounded-full"
              style={{ backgroundColor: event.color }}
            />
            <span className="flex w-[80px] shrink-0 items-center gap-1 text-text-tertiary">
              <Clock className="size-2.5" />
              {formatEventTime(event)}
            </span>
            <span className="flex-1 truncate text-text-secondary">{event.title}</span>
            {hasNote ? (
              <FileText
                className="size-3 shrink-0 text-text-tertiary"
                aria-label="Has linked note"
              />
            ) : null}
          </button>
        )
      })}
      {errors.length > 0 ? (
        <div className="mt-1 flex flex-col gap-0.5 px-2 text-[10px] text-text-tertiary">
          {errors.map((e, i) => (
            <span key={i}>
              ⚠ {e.feedName}: {e.message}
            </span>
          ))}
        </div>
      ) : null}
    </div>
  )
}
