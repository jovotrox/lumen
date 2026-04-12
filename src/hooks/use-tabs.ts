import { useAtom } from "jotai"
import { useRouter } from "@tanstack/react-router"
import { openTabsAtom, Tab } from "../global-state"

/** Normalize a route path for comparison (strip query params, trailing slashes, base path) */
function normalizePath(path: string): string {
  return (
    path
      .replace(/\?.*$/, "")
      .replace(/^\/lumen/, "")
      .replace(/\/$/, "") || "/"
  )
}

export function useTabs() {
  const [tabs, setTabs] = useAtom(openTabsAtom)
  const router = useRouter()

  // Derive active tab path from current route
  const currentPath = normalizePath(router.state.location.pathname)

  const activeTabIndex = tabs.findIndex((t) => normalizePath(t.path) === currentPath)

  /**
   * Create a NEW tab (explicit action: Cmd+T, +button, Cmd+click).
   * If a tab for this path already exists, just switch to it.
   */
  const openTab = (path: string, title: string, icon?: Tab["icon"]) => {
    const normalized = normalizePath(path)
    setTabs((prev) => {
      if (prev.some((t) => normalizePath(t.path) === normalized)) {
        return prev.map((t) => (normalizePath(t.path) === normalized ? { ...t, title, icon } : t))
      }
      return [...prev, { path: normalized, title, icon }]
    })
  }

  /**
   * Update the current active tab to show a different page.
   * This is for normal navigation — NOT for creating new tabs.
   * If no tabs exist, does nothing (tabs are only created explicitly).
   */
  const updateActiveTab = (path: string, title: string, icon?: Tab["icon"]) => {
    const normalized = normalizePath(path)
    setTabs((prev) => {
      // If this path already has a tab, just update title/icon
      if (prev.some((t) => normalizePath(t.path) === normalized)) {
        return prev.map((t) => (normalizePath(t.path) === normalized ? { ...t, title, icon } : t))
      }

      // If no tabs exist, don't create one
      if (prev.length === 0) {
        return prev
      }

      // Replace the active tab with the new page
      if (activeTabIndex >= 0) {
        return prev.map((t, i) => (i === activeTabIndex ? { path: normalized, title, icon } : t))
      }

      // Fallback: replace the last tab
      return prev.map((t, i) => (i === prev.length - 1 ? { path: normalized, title, icon } : t))
    })
  }

  const closeTab = (path: string) => {
    const normalized = normalizePath(path)
    const index = tabs.findIndex((t) => normalizePath(t.path) === normalized)
    if (index === -1) return

    const newTabs = tabs.filter((t) => normalizePath(t.path) !== normalized)
    setTabs(newTabs)

    // Only navigate if closing the active tab
    if (index === activeTabIndex) {
      if (newTabs.length > 0) {
        const nextIndex = Math.min(index, newTabs.length - 1)
        router.navigate({ to: newTabs[nextIndex].path })
      } else {
        router.navigate({ to: "/notes", search: { query: undefined, view: "grid" } })
      }
    }
  }

  const closeOtherTabs = (path: string) => {
    const normalized = normalizePath(path)
    setTabs((prev) => prev.filter((t) => normalizePath(t.path) === normalized))
  }

  const closeAllTabs = () => {
    setTabs([])
    router.navigate({ to: "/notes", search: { query: undefined, view: "grid" } })
  }

  return {
    tabs,
    activeTabIndex,
    currentPath,
    openTab,
    updateActiveTab,
    closeTab,
    closeOtherTabs,
    closeAllTabs,
  }
}
