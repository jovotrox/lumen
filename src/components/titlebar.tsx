import { useRouter } from "@tanstack/react-router"
import { useAtom, useAtomValue } from "jotai"
import { FolderOpen, Home, Inbox, Link as LinkIcon, Plus, Settings, User, X } from "lucide-react"
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
  TagIcon16,
  TaskListIcon16,
} from "./icons"
import { generateNoteId } from "../utils/note-id"

// Custom 16x16 SVG icons scale well at 14px
const icon16 = "size-3.5 shrink-0 opacity-70"
// Lucide 24x24 icons need to be smaller to visually match
const iconLucide = "size-3 shrink-0 opacity-70"

function TabIcon({ tab }: { tab: Tab }) {
  switch (tab.icon) {
    case "daily": {
      const match = tab.path.match(/\/notes\/\d{4}-\d{2}-(\d{2})/)
      const day = match ? parseInt(match[1], 10) : undefined
      return <CalendarDateIcon16 date={day} className={icon16} />
    }
    case "weekly":
    case "calendar":
      return <CalendarIcon16 className={icon16} />
    case "home":
      return <Home className={iconLucide} />
    case "inbox":
      return <Inbox className={iconLucide} />
    case "project":
      return <FolderOpen className={iconLucide} />
    case "tasks":
      return <TaskListIcon16 className={icon16} />
    case "links":
      return <LinkIcon className={iconLucide} />
    case "people":
    case "person":
      return <User className={iconLucide} />
    case "tags":
      return <TagIcon16 className={icon16} />
    case "settings":
      return <Settings className={iconLucide} />
    default:
      return <NoteIcon16 className={icon16} />
  }
}

export function Titlebar() {
  const router = useRouter()
  const [sidebar, setSidebar] = useAtom(sidebarAtom)
  const tabs = useAtomValue(openTabsAtom)
  const { activeTabIndex, closeTab } = useTabs()
  const isDesktop = isElectron() || isTauri()

  if (!isDesktop) return null

  const isMac = navigator.platform.startsWith("Mac")

  return (
    <div
      className="flex h-[38px] shrink-0 items-center bg-bg-secondary print:hidden"
      style={{ WebkitAppRegion: "drag" } as React.CSSProperties}
    >
      {isMac ? <div className="w-[76px] shrink-0" /> : null}

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

      <div
        className="flex min-w-0 items-center overflow-x-auto scrollbar-hide"
        style={{ WebkitAppRegion: "no-drag" } as React.CSSProperties}
      >
        {tabs.map((tab, i) => {
          const isActive = i === activeTabIndex
          const isLast = i === tabs.length - 1
          return (
            <React.Fragment key={tab.path}>
              <button
                className={cx(
                  "group relative flex h-[37px] w-[160px] shrink-0 items-center gap-1.5 pl-3 pr-2 text-xs transition-colors",
                  isActive ? "bg-bg text-text" : "text-text-secondary hover:text-text",
                )}
                onClick={() => {
                  router.navigate({ to: tab.path })
                }}
                onAuxClick={(e) => {
                  if (e.button === 1) {
                    e.preventDefault()
                    closeTab(tab.path)
                  }
                }}
              >
                <TabIcon tab={tab} />
                <span className="min-w-0 flex-1 truncate text-left">{tab.title}</span>
                {/* Close button with gradient fade — hidden until hover */}
                <span
                  className={cx(
                    "absolute right-0 top-0 flex h-full items-center pr-2 pl-4 opacity-0 transition-opacity group-hover:opacity-100",
                    isActive
                      ? "bg-gradient-to-l from-[var(--color-bg)] from-50% to-transparent"
                      : "bg-gradient-to-l from-[var(--color-bg-secondary)] from-50% to-transparent",
                  )}
                  onMouseDown={(e) => {
                    e.preventDefault()
                    e.stopPropagation()
                  }}
                  onClick={(e) => {
                    e.stopPropagation()
                    closeTab(tab.path)
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.stopPropagation()
                      closeTab(tab.path)
                    }
                  }}
                  role="button"
                  tabIndex={0}
                  aria-label={`Close ${tab.title}`}
                >
                  <X className="size-3.5 rounded p-0.5 hover:bg-border-secondary" />
                </span>
              </button>
              {!isLast ? <div className="h-4 w-px shrink-0 bg-border-secondary" /> : null}
            </React.Fragment>
          )
        })}

        {tabs.length > 0 ? <div className="h-4 w-px shrink-0 bg-border-secondary" /> : null}

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

      <div className="flex-1 self-stretch" />
    </div>
  )
}
