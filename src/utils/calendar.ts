export interface CalendarFeed {
  id: string
  name: string
  url: string
  color: string // hex
  enabled: boolean
}

export interface CalendarEvent {
  title: string
  start: string // ISO date string
  end: string // ISO date string
  calendar: string // feed name
  color: string // hex (from feed)
  isAllDay: boolean
  location?: string
}

// Apple-inspired palette for feed colors
export const FEED_COLORS = [
  "#FF3B30", // red
  "#FF9500", // orange
  "#FFCC00", // yellow
  "#34C759", // green
  "#007AFF", // blue
  "#5856D6", // indigo
  "#AF52DE", // purple
  "#FF2D92", // pink
] as const
