import React from "react"
import { CalendarEvent, fetchCalendarEvents, formatEventTime } from "../utils/calendar"
import { isElectron } from "../utils/electron"
import { Clock } from "lucide-react"

export function CalendarEvents({ dateString }: { dateString: string }) {
  const [events, setEvents] = React.useState<CalendarEvent[]>([])
  const [loading, setLoading] = React.useState(true)

  React.useEffect(() => {
    if (!isElectron()) {
      setLoading(false)
      return
    }

    setLoading(true)
    fetchCalendarEvents(dateString)
      .then(setEvents)
      .catch(() => setEvents([]))
      .finally(() => setLoading(false))
  }, [dateString])

  // Don't render anything in browser or when no events
  if (!isElectron() || (!loading && events.length === 0)) return null

  if (loading) return null // Silent loading, no spinner

  // Sort: all-day first, then by start time
  const sorted = [...events].sort((a, b) => {
    if (a.isAllDay && !b.isAllDay) return -1
    if (!a.isAllDay && b.isAllDay) return 1
    return new Date(a.start).getTime() - new Date(b.start).getTime()
  })

  return (
    <div className="flex flex-col gap-1 px-4 py-2">
      {sorted.map((event, i) => (
        <div
          key={`${event.title}-${event.start}-${i}`}
          className="flex items-center gap-2 rounded px-2 py-1 text-xs text-text-secondary"
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
    </div>
  )
}
