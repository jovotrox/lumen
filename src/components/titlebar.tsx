import { useRouter } from "@tanstack/react-router"
import { useAtom, useAtomValue, useSetAtom } from "jotai"
import { Calendar, FolderOpen, Home, Inbox, Plus, Settings, User, X } from "lucide-react"
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
  LinkIcon16,
  NoteIcon16,
  SidebarCollapsedIcon16,
  SidebarIcon16,
  TagIcon16,
  TaskListIcon16,
} from "./icons"
import { commandMenuNewTabAtom, isCommandMenuOpenAtom } from "./command-menu"
import { getLeadingEmoji, removeLeadingEmoji } from "../utils/emoji"

// Lucide icons: size-3 (12px) with thinner strokes to feel subtle
const lucide = { className: "shrink-0 opacity-60", size: 12, strokeWidth: 1.75 }
// Custom 16x16 filled icons: slightly smaller to match Lucide visual weight
const custom = "size-[11px] shrink-0 opacity-60"

function TabIcon({ tab }: { tab: Tab }) {
  // If the tab title starts with an emoji, show it instead of the default icon
  const emoji = getLeadingEmoji(tab.title)
  if (emoji) {
    return <span className="shrink-0 text-xs leading-none">{emoji}</span>
  }

  switch (tab.icon) {
    case "daily": {
      const match = tab.path.match(/\/notes\/\d{4}-\d{2}-(\d{2})/)
      const day = match ? parseInt(match[1], 10) : undefined
      return <CalendarDateIcon16 date={day} className={custom} />
    }
    case "weekly":
    case "calendar":
      return <Calendar {...lucide} />
    case "home":
      return <Home {...lucide} />
    case "inbox":
      return <Inbox {...lucide} />
    case "project":
      return <FolderOpen {...lucide} />
    case "tasks":
      return <TaskListIcon16 className={custom} />
    case "links":
      return <LinkIcon16 className={custom} />
    case "people":
    case "person":
      return <User {...lucide} />
    case "tags":
      return <TagIcon16 className={custom} />
    case "settings":
      return <Settings {...lucide} />
    default:
      return <NoteIcon16 className={custom} />
  }
}

export function Titlebar() {
  const router = useRouter()
  const [sidebar, setSidebar] = useAtom(sidebarAtom)
  const tabs = useAtomValue(openTabsAtom)
  const { activeTabIndex, closeTab } = useTabs()
  const setCommandMenuOpen = useSetAtom(isCommandMenuOpenAtom)
  const setCommandMenuNewTab = useSetAtom(commandMenuNewTabAtom)
  const isDesktop = isElectron() || isTauri()

  if (!isDesktop) return null

  const isMac = navigator.platform.startsWith("Mac")
  // Traffic light spacer only when sidebar is collapsed (when expanded, sidebar handles it)
  const needsTrafficLightSpacer = isMac && sidebar === "collapsed"

  const handleCloseTab = (index: number) => {
    if (tabs.length <= 1) {
      // Last tab — close the window
      window.electronAPI?.closeWindow()
    } else {
      closeTab(index)
    }
  }

  return (
    <div
      className={cx("flex h-[38px] shrink-0 select-none items-center bg-bg-sidebar print:hidden")}
      style={{ WebkitAppRegion: "drag" } as React.CSSProperties}
    >
      {needsTrafficLightSpacer ? <div className="w-[76px] shrink-0" /> : null}

      <div
        className="flex items-center gap-0.5 px-1 sm:px-2"
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
            <React.Fragment key={`${tab.path}-${i}`}>
              <button
                className={cx(
                  "group relative flex h-[38px] w-[160px] shrink-0 items-center gap-1.5 pl-3 pr-2 text-xs transition-colors",
                  isActive ? "bg-bg text-text" : "text-text-secondary hover:text-text",
                )}
                onClick={() => {
                  router.navigate({ to: tab.path })
                }}
                onAuxClick={(e) => {
                  if (e.button === 1) {
                    e.preventDefault()
                    handleCloseTab(i)
                  }
                }}
              >
                <TabIcon tab={tab} />
                <span className="min-w-0 flex-1 truncate text-left">
                  {getLeadingEmoji(tab.title) ? removeLeadingEmoji(tab.title) : tab.title}
                </span>
                {/* Close button with gradient fade — hidden until hover */}
                <span
                  className={cx(
                    "absolute right-0 top-0 flex h-full items-center pr-2 pl-4 opacity-0 transition-opacity group-hover:opacity-100",
                    isActive
                      ? "bg-gradient-to-l from-[var(--color-bg)] from-50% to-transparent"
                      : "bg-gradient-to-l from-[var(--color-bg-sidebar)] from-50% to-transparent",
                  )}
                  onMouseDown={(e) => {
                    e.preventDefault()
                    e.stopPropagation()
                  }}
                  onClick={(e) => {
                    e.stopPropagation()
                    handleCloseTab(i)
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.stopPropagation()
                      handleCloseTab(i)
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

        <IconButton
          aria-label="New tab"
          size="small"
          className="mx-1"
          onClick={() => {
            setCommandMenuNewTab(true)
            setCommandMenuOpen(true)
          }}
        >
          <Plus size={16} />
        </IconButton>
      </div>

      <div className="flex-1 self-stretch" />
    </div>
  )
}
