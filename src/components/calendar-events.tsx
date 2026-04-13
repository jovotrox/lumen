import { useAtomValue } from "jotai"
import { Calendar, Clock } from "lucide-react"
import React from "react"
import { calendarIntegrationAtom } from "../global-state"
import { CalendarResult, fetchCalendarEvents, formatEventTime } from "../utils/calendar"
import { isElectron } from "../utils/electron"

export function CalendarEvents({ dateString }: { dateString: string }) {
  const enabled = useAtomValue(calendarIntegrationAtom)
  const [result, setResult] = React.useState<CalendarResult>({ denied: false, events: [] })
  const [loading, setLoading] = React.useState(false)

  React.useEffect(() => {
    if (!isElectron() || !enabled) {
      setResult({ denied: false, events: [] })
      setLoading(false)
      return
    }

    setLoading(true)
    fetchCalendarEvents(dateString)
      .then(setResult)
      .catch(() => setResult({ denied: true, events: [] }))
      .finally(() => setLoading(false))
  }, [dateString, enabled])

  if (!isElectron() || !enabled) return null
  if (loading) return null

  if (result.denied) {
    return (
      <div className="flex items-center gap-2 px-4 py-2 text-xs text-text-tertiary">
        <Calendar className="size-3 opacity-60" />
        <span>
          Calendar access denied. Enable in{" "}
          <span className="text-text-secondary">
            System Settings &gt; Privacy &amp; Security &gt; Calendars
          </span>
        </span>
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
