import { useAtomValue } from "jotai"
import { Calendar, Clock } from "lucide-react"
import React from "react"
import { calendarIcsUrlAtom, calendarIntegrationAtom } from "../global-state"
import { CalendarResult, fetchCalendarEvents, formatEventTime } from "../utils/calendar"

export function CalendarEvents({ dateString }: { dateString: string }) {
  const enabled = useAtomValue(calendarIntegrationAtom)
  const icsUrl = useAtomValue(calendarIcsUrlAtom)
  const [result, setResult] = React.useState<CalendarResult>({ events: [] })
  const [loading, setLoading] = React.useState(false)

  React.useEffect(() => {
    if (!enabled || !icsUrl) {
      setResult({ events: [] })
      setLoading(false)
      return
    }

    setLoading(true)
    fetchCalendarEvents(dateString, icsUrl)
      .then(setResult)
      .catch((e) => setResult({ events: [], error: (e as Error).message }))
      .finally(() => setLoading(false))
  }, [dateString, enabled, icsUrl])

  if (!enabled) return null
  if (!icsUrl) {
    return (
      <div className="flex items-center gap-2 px-4 py-2 text-xs text-text-tertiary">
        <Calendar className="size-3 opacity-60" />
        <span>No calendar URL configured. Add one in Settings.</span>
      </div>
    )
  }
  if (loading) return null

  if (result.error) {
    return (
      <div className="flex items-center gap-2 px-4 py-2 text-xs text-text-tertiary">
        <Calendar className="size-3 opacity-60" />
        <span>Calendar error: {result.error}</span>
      </div>
    )
  }

  if (result.events.length === 0) return null

  const sorted = [...result.events].sort((a, b) => {
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
