import {
  FolderOpen,
  Hash,
  Home as HomeIcon,
  Inbox as InboxIcon,
  Link as LinkIcon,
  Settings as SettingsIcon,
  Tag as TagIcon,
  User as UserIcon,
} from "lucide-react"
import { useAtomValue } from "jotai"
import { notesAtom, TrailSegment } from "../global-state"
import { NoteFavicon } from "./note-favicon"
import { CalendarDateIcon16, NoteIcon16, TaskListIcon16 } from "./icons"

type Props = { segment: TrailSegment; size?: number }

/**
 * Resolve the icon for a breadcrumb segment based on its `iconKind`:
 * - "note"  → NoteFavicon for the note id (may include cover art for books/films)
 * - "tag"   → Lucide Hash at the chosen size
 * - "route" → Map from route key (matches Tab["icon"]) to a Lucide/Lumen icon
 *
 * Default size matches --icon-size (16px) so breadcrumb and the fallback
 * PageHeader's icon stay visually identical (no jump when toggling).
 */
export function BreadcrumbIcon({ segment, size = 16 }: Props) {
  const notes = useAtomValue(notesAtom)

  if (segment.iconKind === "note") {
    const note = notes.get(segment.iconRef)
    if (note) return <NoteFavicon note={note} />
    // Fallback when the note hasn't loaded yet (e.g., fresh app start, persisted tab).
    return <NoteIcon16 />
  }

  if (segment.iconKind === "tag") {
    return <Hash size={size} />
  }

  // iconKind === "route"
  switch (segment.iconRef) {
    case "note":
      return <NoteIcon16 />
    case "project":
      return <FolderOpen size={size} />
    case "people":
    case "person":
      return <UserIcon size={size} />
    case "tasks":
      return <TaskListIcon16 />
    case "links":
      return <LinkIcon size={size} />
    case "inbox":
      return <InboxIcon size={size} />
    case "tags":
      return <TagIcon size={size} />
    case "calendar":
    case "daily":
    case "weekly":
      return <CalendarDateIcon16 date={new Date().getDate()} />
    case "home":
      return <HomeIcon size={size} />
    case "settings":
      return <SettingsIcon size={size} />
    default:
      return <NoteIcon16 />
  }
}
