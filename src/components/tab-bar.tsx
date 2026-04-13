import { useAtomValue } from "jotai"
import { X } from "lucide-react"
import React from "react"
import { useRouter } from "@tanstack/react-router"
import { openTabsAtom } from "../global-state"
import { useTabs } from "../hooks/use-tabs"
import { cx } from "../utils/cx"
import { isElectron } from "../utils/electron"
import { isTauri } from "../utils/tauri"

export function TabBar() {
  const tabs = useAtomValue(openTabsAtom)
  const { activeTabIndex, closeTab } = useTabs()
  const router = useRouter()

  // On desktop, tabs are shown in the Titlebar instead
  if (isElectron() || isTauri()) return null

  if (tabs.length <= 1) return null

  return (
    <div className="flex shrink-0 select-none items-center gap-0 overflow-x-auto border-b border-border-secondary bg-bg-secondary scrollbar-hide print:hidden">
      {tabs.map((tab, i) => {
        const isActive = i === activeTabIndex
        return (
          <button
            key={tab.path}
            className={cx(
              "group flex shrink-0 items-center gap-1.5 border-r border-border-secondary px-3 py-1.5 text-xs transition-colors",
              isActive
                ? "border-b-2 border-b-border-focus bg-bg text-text"
                : "text-text-secondary hover:bg-bg hover:text-text",
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
            <span className="max-w-[150px] truncate">{tab.title}</span>
            <span
              className={cx(
                "flex items-center justify-center rounded p-0.5 hover:bg-bg-secondary",
                isActive ? "opacity-100" : "opacity-0 group-hover:opacity-100",
              )}
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
              <X className="size-3" />
            </span>
          </button>
        )
      })}
    </div>
  )
}
