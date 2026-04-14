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
      <AnimatePresence mode="popLayout">
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
