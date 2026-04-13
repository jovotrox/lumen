import { useAtomValue } from "jotai"
import { Calendar, Clock } from "lucide-react"
import React from "react"
import { calendarFeedsAtom, calendarIntegrationAtom } from "../global-state"
import { CalendarEvent, fetchAllFeedsEvents, formatEventTime } from "../utils/calendar"

export function CalendarEvents({ dateString }: { dateString: string }) {
  const enabled = useAtomValue(calendarIntegrationAtom)
  const feeds = useAtomValue(calendarFeedsAtom)
  const [events, setEvents] = React.useState<CalendarEvent[]>([])
  const [errors, setErrors] = React.useState<Array<{ feedName: string; message: string }>>([])
  const [loading, setLoading] = React.useState(false)

  const activeFeeds = feeds.filter((f) => f.enabled && f.url)

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
  }, [dateString, enabled, JSON.stringify(activeFeeds.map((f) => [f.id, f.url, f.color, f.name]))])

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
      {events.map((event, i) => (
        <div
          key={`${event.title}-${event.start}-${i}`}
          className="flex items-center gap-2 rounded px-2 py-1 text-xs text-text-secondary"
          title={event.calendar || undefined}
        >
          <div
            className="h-3 w-0.5 shrink-0 rounded-full"
            style={{ backgroundColor: event.color }}
          />
          <span className="flex w-[80px] shrink-0 items-center gap-1 text-text-tertiary">
            <Clock className="size-2.5" />
            {formatEventTime(event)}
          </span>
          <span className="truncate text-text-secondary">{event.title}</span>
        </div>
      ))}
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
