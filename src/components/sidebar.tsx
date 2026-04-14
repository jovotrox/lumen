import { useRouter } from "@tanstack/react-router"
import { useSetAtom } from "jotai"
import { sidebarAtom } from "../global-state"
import { useCreateNewNote } from "../hooks/create-new-note"
import { useIsScrolled } from "../hooks/is-scrolled"
import { cx } from "../utils/cx"
import { isElectron } from "../utils/electron"
import { isTauri } from "../utils/tauri"
import { IconButton } from "./icon-button"
import { ArrowLeftIcon16, ArrowRightIcon16, ComposeIcon16, SidebarIcon16 } from "./icons"
import { NavItems } from "./nav-items"

export function Sidebar() {
  const router = useRouter()
  const setSidebar = useSetAtom(sidebarAtom)
  const createNewNote = useCreateNewNote()
  const { isScrolled, topSentinelProps } = useIsScrolled()
  const isDesktop = isElectron() || isTauri()
  const isMac = typeof navigator !== "undefined" && navigator.platform.startsWith("Mac")

  return (
    <div className="flex h-full select-none flex-col overflow-hidden border-r border-border-secondary bg-bg-sidebar">
      {isDesktop ? (
        <div
          className="flex h-[38px] shrink-0 items-center px-2"
          style={{ WebkitAppRegion: "drag" } as React.CSSProperties}
        >
          {/* macOS traffic light space */}
          {isMac ? <div className="w-[70px] shrink-0" /> : null}
          {/* New note button with label */}
          <button
            className="flex cursor-pointer items-center gap-1.5 rounded px-1.5 py-0.5 text-sm text-text-secondary transition-colors hover:bg-bg-hover hover:text-text"
            style={{ WebkitAppRegion: "no-drag" } as React.CSSProperties}
            onClick={createNewNote}
            aria-label="New note"
          >
            <ComposeIcon16 className="size-icon shrink-0" />
            <span className="text-xs">New note</span>
          </button>
        </div>
      ) : (
        <div
          className={cx(
            "flex w-full justify-between border-b p-2",
            isScrolled ? "border-border-secondary" : "border-transparent",
          )}
        >
          <div>
            <IconButton
              aria-label="Hide sidebar"
              shortcut={["⌘", "⇧", "S"]}
              tooltipAlign="start"
              size="small"
              onClick={() => setSidebar("collapsed")}
            >
              <SidebarIcon16 />
            </IconButton>
          </div>
          <div className="flex items-center">
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
            <IconButton
              aria-label="New note"
              shortcut={["⌘", "⇧", "O"]}
              size="small"
              onClick={createNewNote}
            >
              <ComposeIcon16 />
            </IconButton>
          </div>
        </div>
      )}
      <div className="relative flex flex-1 scroll-py-2 flex-col gap-2 overflow-auto p-2">
        <div {...topSentinelProps} />
        <NavItems />
      </div>
    </div>
  )
}
