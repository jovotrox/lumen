import { useAtom } from "jotai"
import { useRouter } from "@tanstack/react-router"
import { openTabsAtom, Tab } from "../global-state"

export function useTabs() {
  const [tabs, setTabs] = useAtom(openTabsAtom)
  const router = useRouter()

  // Derive active tab from current route
  const activeTabId = (() => {
    const path = router.state.location.pathname
    const match = path.match(/\/notes\/(.+)/)
    return match ? match[1] : null
  })()

  /**
   * Create a NEW tab (explicit action: Cmd+T, +button, Cmd+click).
   * If a tab for this noteId already exists, just switch to it.
   */
  const openTab = (noteId: string, title: string, type?: Tab["type"]) => {
    setTabs((prev) => {
      if (prev.some((t) => t.noteId === noteId)) {
        return prev.map((t) => (t.noteId === noteId ? { ...t, title, type } : t))
      }
      return [...prev, { noteId, title, type }]
    })
  }

  /**
   * Update the current active tab to show a different note.
   * This is for normal navigation (sidebar clicks, links) — NOT for creating new tabs.
   * If no tabs exist yet, creates the first one.
   */
  const updateActiveTab = (noteId: string, title: string, type?: Tab["type"]) => {
    setTabs((prev) => {
      // If this noteId already has a tab, just update it
      if (prev.some((t) => t.noteId === noteId)) {
        return prev.map((t) => (t.noteId === noteId ? { ...t, title, type } : t))
      }

      // If no tabs exist, don't create one — tabs are only created explicitly
      if (prev.length === 0) {
        return prev
      }

      // Replace the active tab with the new note
      const activeIndex = prev.findIndex((t) => t.noteId === activeTabId)
      if (activeIndex >= 0) {
        return prev.map((t, i) => (i === activeIndex ? { noteId, title, type } : t))
      }

      // Fallback: replace the last tab
      return prev.map((t, i) => (i === prev.length - 1 ? { noteId, title, type } : t))
    })
  }

  const closeTab = (noteId: string) => {
    const currentTabs = tabs
    const index = currentTabs.findIndex((t) => t.noteId === noteId)
    if (index === -1) return

    const newTabs = currentTabs.filter((t) => t.noteId !== noteId)
    setTabs(newTabs)

    // Only navigate if closing the active tab
    if (noteId === activeTabId) {
      if (newTabs.length > 0) {
        const nextIndex = Math.min(index, newTabs.length - 1)
        router.navigate({
          to: "/notes/$",
          params: { _splat: newTabs[nextIndex].noteId },
          search: { mode: "read", query: undefined, view: "grid" },
        })
      } else {
        router.navigate({ to: "/notes", search: { query: undefined, view: "grid" } })
      }
    }
  }

  const closeOtherTabs = (noteId: string) => {
    setTabs((prev) => prev.filter((t) => t.noteId === noteId))
  }

  const closeAllTabs = () => {
    setTabs([])
    router.navigate({ to: "/notes", search: { query: undefined, view: "grid" } })
  }

  return { tabs, activeTabId, openTab, updateActiveTab, closeTab, closeOtherTabs, closeAllTabs }
}
