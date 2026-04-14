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
