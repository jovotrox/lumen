import { FolderOpen, Home, Inbox, User } from "lucide-react"
import { Link, LinkComponentProps, useLocation } from "@tanstack/react-router"
import { useAtom, useAtomValue, useSetAtom } from "jotai"
import { selectAtom } from "jotai/utils"
import { createContext, useContext, useState } from "react"
import { useNetworkState } from "react-use"
import { useRegisterSW } from "virtual:pwa-register/react"
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  DragOverlay,
  type DragEndEvent,
} from "@dnd-kit/core"
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
  arrayMove,
} from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import { saveSettingsToRepo } from "../hooks/use-settings-sync"
import type { Note } from "../schema"
import {
  globalStateMachineAtom,
  isHelpPanelOpenAtom,
  notesAtom,
  pinnedNotesAtom,
  pinnedOrderAtom,
  unprocessedInboxCountAtom,
} from "../global-state"
import { cx } from "../utils/cx"
import { isValidDateString, isValidWeekString, toDateString } from "../utils/date"
import {
  CalendarDateFillIcon16,
  CalendarDateIcon16,
  CircleQuestionMarkFillIcon16,
  CircleQuestionMarkIcon16,
  NoteFillIcon16,
  NoteIcon16,
  OfflineIcon16,
  SettingsFillIcon16,
  SettingsIcon16,
  LinkIcon16,
  TagFillIcon16,
  TagIcon16,
  TaskListIcon16,
} from "./icons"
import { NoteFavicon } from "./note-favicon"
import { SyncStatusIcon, useSyncStatusText } from "./sync-status"

const hasDailyNoteAtom = selectAtom(notesAtom, (notes) => notes.has(toDateString(new Date())))

const SizeContext = createContext<"medium" | "large">("medium")

export function NavItems({
  size = "medium",
  onNavigate,
}: {
  size?: "medium" | "large"
  onNavigate?: () => void
}) {
  const pinnedNotes = useAtomValue(pinnedNotesAtom)
  const setPinnedOrder = useSetAtom(pinnedOrderAtom)
  const hasDailyNote = useAtomValue(hasDailyNoteAtom)
  const inboxCount = useAtomValue(unprocessedInboxCountAtom)
  const syncText = useSyncStatusText()
  const send = useSetAtom(globalStateMachineAtom)
  const { online } = useNetworkState()
  const { pathname } = useLocation()

  // Drag-to-reorder for pinned notes.
  // activationConstraint: distance=5px so a plain click still navigates —
  // only actual dragging engages the sortable machinery.
  // KeyboardSensor enables arrow-key reordering for non-pointer users.
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )
  const [draggingId, setDraggingId] = useState<string | null>(null)
  const draggingNote = draggingId ? pinnedNotes.find((n) => n.id === draggingId) : null

  const handleDragEnd = (event: DragEndEvent) => {
    setDraggingId(null)
    const { active, over } = event
    if (!over || active.id === over.id) return
    const ids = pinnedNotes.map((n) => n.id)
    const oldIndex = ids.indexOf(active.id as string)
    const newIndex = ids.indexOf(over.id as string)
    if (oldIndex === -1 || newIndex === -1) return
    setPinnedOrder(arrayMove(ids, oldIndex, newIndex))
    // Persist to the synced settings file so the order propagates across devices.
    // Fire-and-forget — the localStorage atom write already took effect.
    void saveSettingsToRepo()
  }

  const today = new Date()
  const todayString = toDateString(today)

  // Calendar link is active when viewing any daily or weekly note
  const noteId = pathname.startsWith("/notes/") ? pathname.slice(7) : ""
  const isCalendarActive = isValidDateString(noteId) || isValidWeekString(noteId)

  // Reference: https://vite-pwa-org.netlify.app/frameworks/react.html#prompt-for-update
  const {
    needRefresh: [needRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegistered(registration) {
      console.log("SW registered: " + registration)

      if (registration) {
        // Check for updates every hour
        setInterval(
          () => {
            registration.update()
          },
          60 * 60 * 1000,
        )
      }
    },
    onRegisterError(error) {
      console.error("SW registration error", error)
    },
  })

  return (
    <SizeContext.Provider value={size}>
      <div className="flex min-h-full grow flex-col justify-between gap-6">
        <div className="flex flex-col gap-2">
          <ul className="flex flex-col gap-1">
            <li>
              <NavLink to="/" icon={<Home size={16} />} onNavigate={onNavigate}>
                Home
              </NavLink>
            </li>
            <li>
              <NavLink
                to="/inbox"
                search={{ query: undefined }}
                icon={<Inbox size={16} />}
                onNavigate={onNavigate}
              >
                <span className="flex items-center gap-2">
                  Inbox
                  {inboxCount > 0 ? (
                    <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-border-focus px-1 text-[10px] font-medium text-bg">
                      {inboxCount}
                    </span>
                  ) : null}
                </span>
              </NavLink>
            </li>
            <li>
              <NavLink
                to="/notes/$"
                params={{ _splat: todayString }}
                search={{
                  mode: hasDailyNote ? "read" : "write",
                  query: undefined,
                  view: "grid",
                }}
                activeIcon={<CalendarDateFillIcon16 date={today.getDate()} />}
                icon={<CalendarDateIcon16 date={today.getDate()} />}
                forceActive={isCalendarActive}
                onNavigate={onNavigate}
              >
                Calendar
              </NavLink>
            </li>
            <li>
              <NavLink
                to="/notes"
                search={{ query: undefined, view: "grid" }}
                activeIcon={<NoteFillIcon16 />}
                icon={<NoteIcon16 />}
                onNavigate={onNavigate}
              >
                Notes
              </NavLink>
            </li>
            <li>
              <NavLink
                to="/projects"
                search={{ query: undefined, view: "list" }}
                icon={<FolderOpen size={16} />}
                onNavigate={onNavigate}
              >
                Projects
              </NavLink>
            </li>
            <li>
              <NavLink
                to="/tasks"
                search={{ query: undefined, view: "grid" }}
                icon={<TaskListIcon16 />}
                onNavigate={onNavigate}
              >
                Tasks
              </NavLink>
            </li>
            <li>
              <NavLink
                to="/links"
                search={{ query: undefined, view: "grid" }}
                icon={<LinkIcon16 />}
                onNavigate={onNavigate}
              >
                Links
              </NavLink>
            </li>
            <li>
              <NavLink
                to="/people"
                search={{ query: undefined, view: "list" }}
                icon={<User size={16} />}
                onNavigate={onNavigate}
              >
                People
              </NavLink>
            </li>
            <li>
              <NavLink
                to="/tags"
                search={{ query: undefined, sort: "name", view: "list" }}
                activeIcon={<TagFillIcon16 />}
                icon={<TagIcon16 />}
                onNavigate={onNavigate}
              >
                Tags
              </NavLink>
            </li>
          </ul>
          {pinnedNotes.length > 0 ? (
            <div className="flex flex-col gap-1">
              <div className="flex h-8 select-none items-center px-2 text-sm text-text-secondary coarse:h-10 coarse:px-3">
                Pinned
              </div>
              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragStart={(e) => setDraggingId(e.active.id as string)}
                onDragCancel={() => setDraggingId(null)}
                onDragEnd={handleDragEnd}
              >
                <SortableContext
                  items={pinnedNotes.map((n) => n.id)}
                  strategy={verticalListSortingStrategy}
                >
                  <ul className="flex flex-col gap-1">
                    {pinnedNotes.map((note) => (
                      <SortablePinnedItem key={note.id} note={note} onNavigate={onNavigate} />
                    ))}
                  </ul>
                </SortableContext>
                <DragOverlay
                  dropAnimation={{ duration: 180, easing: "cubic-bezier(0.2, 0, 0, 1)" }}
                >
                  {draggingNote ? (
                    <div className="cursor-grabbing rounded bg-bg-secondary shadow-lg opacity-90">
                      <div className="nav-item pointer-events-none">
                        <span className="flex shrink-0 text-text-secondary">
                          <NoteFavicon note={draggingNote} />
                        </span>
                        <span className="truncate">{draggingNote.displayName}</span>
                      </div>
                    </div>
                  ) : null}
                </DragOverlay>
              </DndContext>
            </div>
          ) : null}
        </div>
        <div className="flex flex-col gap-1">
          {needRefresh ? (
            <button className="nav-item" data-size={size} onClick={() => updateServiceWorker(true)}>
              <div className="grid size-4 place-items-center [&>*]:row-span-full [&>*]:col-span-full">
                <div className="size-3 rounded-full bg-border-focus opacity-50 animate-ping" />
                <div className="size-2 rounded-full bg-border-focus" />
              </div>
              Update Lumen
            </button>
          ) : null}
          {!online ? (
            <div className="nav-item text-text-secondary" data-size={size}>
              <OfflineIcon16 />
              Offline
            </div>
          ) : null}
          {syncText ? (
            <button
              className="nav-item text-text-secondary"
              data-size={size}
              onClick={() => send({ type: "SYNC" })}
            >
              <SyncStatusIcon />
              {syncText}
            </button>
          ) : null}
          <NavLink
            to="/settings"
            search={{ query: undefined }}
            activeIcon={<SettingsFillIcon16 />}
            icon={<SettingsIcon16 />}
            className="text-text-secondary"
            onNavigate={onNavigate}
          >
            Settings
          </NavLink>
          <HelpNavItem size={size} />
        </div>
      </div>
    </SizeContext.Provider>
  )
}

function NavLink({
  className,
  activeIcon,
  icon,
  includeSearch = false,
  forceActive = false,
  onNavigate,
  children,
  onClick,
  ...props
}: LinkComponentProps<"a"> & {
  activeIcon?: React.ReactNode
  icon: React.ReactNode
  includeSearch?: boolean
  forceActive?: boolean
  onNavigate?: () => void
  children: React.ReactNode
}) {
  const size = useContext(SizeContext)

  return (
    <Link
      activeOptions={{ exact: true, includeSearch }}
      data-size={size}
      className={cx("nav-item", className)}
      aria-current={forceActive ? "page" : undefined}
      // Prevent the browser's default link-drag (ghost showing the URL).
      // Native apps don't let you drag a nav item out of the window.
      draggable={false}
      onClick={(event) => {
        onClick?.(event)
        if (!event.defaultPrevented) {
          onNavigate?.()
        }
      }}
      {...props}
    >
      {activeIcon ? (
        <span className="hidden shrink-0 [[aria-current=page]>&]:flex">{activeIcon}</span>
      ) : null}
      <span
        className={cx(
          "flex shrink-0 text-text-secondary",
          activeIcon && "[[aria-current=page]>&]:hidden",
        )}
      >
        {icon}
      </span>
      <span className="truncate">{children}</span>
    </Link>
  )
}

function SortablePinnedItem({ note, onNavigate }: { note: Note; onNavigate?: () => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: note.id,
    // Preserve native list-item semantics — dnd-kit defaults to role="button"
    // which would make screen readers announce each pinned note as a button
    // rather than a list item containing a link.
    attributes: { role: "listitem" },
  })
  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    // Hide the original item while dragging — DragOverlay shows the moving duplicate.
    opacity: isDragging ? 0 : 1,
  }
  return (
    <li
      ref={setNodeRef}
      style={style}
      className="flex cursor-grab active:cursor-grabbing"
      {...attributes}
      {...listeners}
    >
      <NavLink
        to="/notes/$"
        params={{ _splat: note.id }}
        search={{ mode: "read", query: undefined, view: "grid" }}
        icon={<NoteFavicon note={note} className="epaper:[[aria-current=page]_&]:text-bg" />}
        className="w-0 flex-1"
        onNavigate={onNavigate}
      >
        {note.displayName}
      </NavLink>
    </li>
  )
}

export function HelpNavItem({ size }: { size: "medium" | "large" }) {
  const [isOpen, setIsOpen] = useAtom(isHelpPanelOpenAtom)
  return (
    <button
      className="nav-item text-text-secondary"
      data-size={size}
      aria-pressed={isOpen}
      onClick={() => setIsOpen(!isOpen)}
    >
      {isOpen ? <CircleQuestionMarkFillIcon16 /> : <CircleQuestionMarkIcon16 />}
      Help
    </button>
  )
}
