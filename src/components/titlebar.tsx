import { useRouter } from "@tanstack/react-router"
import { useAtom, useAtomValue } from "jotai"
import { FolderOpen, Inbox, Plus, User, X } from "lucide-react"
import React from "react"
import { openTabsAtom, sidebarAtom, Tab } from "../global-state"
import { useTabs } from "../hooks/use-tabs"
import { isElectron } from "../utils/electron"
import { isTauri } from "../utils/tauri"
import { cx } from "../utils/cx"
import { IconButton } from "./icon-button"
import {
  ArrowLeftIcon16,
  ArrowRightIcon16,
  CalendarDateIcon16,
  CalendarIcon16,
  NoteIcon16,
  SidebarCollapsedIcon16,
  SidebarIcon16,
} from "./icons"
import { generateNoteId } from "../utils/note-id"

function TabIcon({ tab }: { tab: Tab }) {
  switch (tab.type) {
    case "daily": {
      // Extract day number from noteId (YYYY-MM-DD)
      const match = tab.noteId.match(/^\d{4}-\d{2}-(\d{2})$/)
      const day = match ? parseInt(match[1], 10) : undefined
      return <CalendarDateIcon16 date={day} className="size-4 shrink-0" />
    }
    case "weekly":
      return <CalendarIcon16 className="size-4 shrink-0" />
    case "project":
      return <FolderOpen className="size-3.5 shrink-0" />
    case "person":
      return <User className="size-3.5 shrink-0" />
    case "inbox":
      return <Inbox className="size-3.5 shrink-0" />
    default:
      return <NoteIcon16 className="size-4 shrink-0" />
  }
}

export function Titlebar() {
  const router = useRouter()
  const [sidebar, setSidebar] = useAtom(sidebarAtom)
  const tabs = useAtomValue(openTabsAtom)
  const { activeTabId, closeTab } = useTabs()
  const isDesktop = isElectron() || isTauri()

  // Only show in desktop apps (Electron/Tauri)
  if (!isDesktop) return null

  const isMac = navigator.platform.startsWith("Mac")

  return (
    <div
      className="flex h-[38px] shrink-0 items-center border-b border-border-secondary bg-bg-secondary print:hidden"
      style={{ WebkitAppRegion: "drag" } as React.CSSProperties}
    >
      {/* Traffic light space on macOS */}
      {isMac ? <div className="w-[76px] shrink-0" /> : null}

      {/* Sidebar toggle + nav buttons */}
      <div
        className="flex items-center gap-0.5 px-1"
        style={{ WebkitAppRegion: "no-drag" } as React.CSSProperties}
      >
        <IconButton
          aria-label={sidebar === "expanded" ? "Hide sidebar" : "Show sidebar"}
          size="small"
          onClick={() => setSidebar((prev) => (prev === "expanded" ? "collapsed" : "expanded"))}
        >
          {sidebar === "expanded" ? <SidebarIcon16 /> : <SidebarCollapsedIcon16 />}
        </IconButton>
        <IconButton
          aria-label="Go back"
          size="small"
          onClick={() => router.history.back()}
          className="group"
        >
          <ArrowLeftIcon16 className="transition-transform group-active:-translate-x-0.5" />
        </IconButton>
        <IconButton
          aria-label="Go forward"
          size="small"
          className="group"
          onClick={() => router.history.forward()}
        >
          <ArrowRightIcon16 className="transition-transform group-active:translate-x-0.5" />
        </IconButton>
      </div>

      {/* Tabs scroll area */}
      <div
        className="flex min-w-0 items-center overflow-x-auto scrollbar-hide"
        style={{ WebkitAppRegion: "no-drag" } as React.CSSProperties}
      >
        {tabs.map((tab, i) => {
          const isActive = tab.noteId === activeTabId
          const isLast = i === tabs.length - 1
          return (
            <React.Fragment key={tab.noteId}>
              <button
                className={cx(
                  "group flex h-[37px] shrink-0 items-center gap-1.5 px-3 text-xs transition-colors",
                  isActive
                    ? "border-t-2 border-t-[var(--color-border-focus)] bg-bg text-text"
                    : "border-t-2 border-t-transparent bg-bg-secondary text-text-secondary hover:text-text",
                )}
                onClick={() => {
                  router.navigate({
                    to: "/notes/$",
                    params: { _splat: tab.noteId },
                    search: { mode: "read", query: undefined, view: "grid" },
                  })
                }}
                onAuxClick={(e) => {
                  if (e.button === 1) {
                    e.preventDefault()
                    closeTab(tab.noteId)
                  }
                }}
              >
                <TabIcon tab={tab} />
                <span className="max-w-[160px] truncate">{tab.title}</span>
                <span
                  className={cx(
                    "flex items-center justify-center rounded p-0.5 hover:bg-bg-secondary",
                    isActive
                      ? "opacity-60 hover:opacity-100"
                      : "opacity-0 group-hover:opacity-60 hover:!opacity-100",
                  )}
                  onMouseDown={(e) => {
                    // Prevent parent <button> from receiving focus
                    e.preventDefault()
                    e.stopPropagation()
                  }}
                  onClick={(e) => {
                    e.stopPropagation()
                    closeTab(tab.noteId)
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.stopPropagation()
                      closeTab(tab.noteId)
                    }
                  }}
                  role="button"
                  tabIndex={0}
                  aria-label={`Close ${tab.title}`}
                >
                  <X className="size-3" />
                </span>
              </button>
              {/* Separator between tabs (not after the last one) */}
              {!isLast ? <div className="h-4 w-px shrink-0 bg-border-secondary" /> : null}
            </React.Fragment>
          )
        })}

        {/* Separator before + button if there are tabs */}
        {tabs.length > 0 ? <div className="h-4 w-px shrink-0 bg-border-secondary" /> : null}

        {/* New tab button */}
        <button
          className="mx-0.5 flex shrink-0 items-center justify-center rounded p-1 text-text-secondary hover:bg-bg hover:text-text"
          onClick={() => {
            const newId = generateNoteId()
            router.navigate({
              to: "/notes/$",
              params: { _splat: newId },
              search: { mode: "write", query: undefined, view: "grid" },
            })
          }}
          aria-label="New tab"
        >
          <Plus className="size-3.5" />
        </button>
      </div>

      {/* Draggable space after tabs — fills remaining titlebar width */}
      <div className="flex-1 self-stretch" />
    </div>
  )
}
