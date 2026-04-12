import { useAtom } from "jotai"
import { useRouter } from "@tanstack/react-router"
import { openTabsAtom } from "../global-state"

export function useTabs() {
  const [tabs, setTabs] = useAtom(openTabsAtom)
  const router = useRouter()

  // Derive active tab from current route
  const activeTabId = (() => {
    const path = router.state.location.pathname
    // Match /notes/{noteId} or /lumen/notes/{noteId}
    const match = path.match(/\/notes\/(.+)/)
    return match ? match[1] : null
  })()

  const openTab = (noteId: string, title: string) => {
    setTabs((prev) => {
      if (prev.some((t) => t.noteId === noteId)) {
        // Tab already exists, just update title if changed
        return prev.map((t) => (t.noteId === noteId ? { ...t, title } : t))
      }
      return [...prev, { noteId, title }]
    })
  }

  const closeTab = (noteId: string) => {
    setTabs((prev) => {
      const index = prev.findIndex((t) => t.noteId === noteId)
      if (index === -1) return prev
      const newTabs = prev.filter((t) => t.noteId !== noteId)

      // If closing the active tab, navigate to adjacent
      if (noteId === activeTabId && newTabs.length > 0) {
        const nextIndex = Math.min(index, newTabs.length - 1)
        router.navigate({
          to: "/notes/$",
          params: { _splat: newTabs[nextIndex].noteId },
          search: { mode: "read", query: undefined, view: "grid" },
        })
      } else if (newTabs.length === 0) {
        router.navigate({ to: "/notes", search: { query: undefined, view: "grid" } })
      }

      return newTabs
    })
  }

  const closeOtherTabs = (noteId: string) => {
    setTabs((prev) => prev.filter((t) => t.noteId === noteId))
  }

  const closeAllTabs = () => {
    setTabs([])
    router.navigate({ to: "/notes", search: { query: undefined, view: "grid" } })
  }

  return { tabs, activeTabId, openTab, closeTab, closeOtherTabs, closeAllTabs }
}
