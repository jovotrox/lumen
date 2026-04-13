import { useAtom } from "jotai"
import { useRouter } from "@tanstack/react-router"
import { defaultTrailAtom, openTabsAtom, Tab, TrailSegment } from "../global-state"
import { isValidDateString, isValidWeekString } from "../utils/date"

/** Normalize a route path for comparison (strip query params, trailing slashes, base path) */
function normalizePath(path: string): string {
  return (
    path
      .replace(/\?.*$/, "")
      .replace(/^\/lumen/, "")
      .replace(/\/$/, "") || "/"
  )
}

/** Static map of root-list paths to their Tab icon (and by extension, breadcrumb route icon). */
const ROOT_ROUTE_ICONS: Record<string, NonNullable<Tab["icon"]>> = {
  "/notes": "note",
  "/projects": "project",
  "/people": "people",
  "/tasks": "tasks",
  "/links": "links",
  "/inbox": "inbox",
  "/tags": "tags",
}

/**
 * Paths that never appear in the breadcrumb trail — Home, Settings, Quick Note.
 * Shared between `computeTrailSegment` (skips the segment) and the renderer
 * (hides the breadcrumb on those routes regardless of what trail currently holds).
 */
export function isBreadcrumbBlacklisted(path: string): boolean {
  const p = normalizePath(path)
  return p === "/" || p.startsWith("/settings") || p.startsWith("/quick-note")
}

/**
 * Compute a breadcrumb segment for a given navigation target, or null if
 * the path is blacklisted (Home, Settings, Quick Note) — blacklisted paths
 * never appear in the trail.
 */
function computeTrailSegment(path: string, title: string, icon?: Tab["icon"]): TrailSegment | null {
  const p = normalizePath(path)

  if (isBreadcrumbBlacklisted(p)) return null

  // Specific note: /notes/$id (but not plain /notes which is handled below)
  const noteMatch = p.match(/^\/notes\/(.+)$/)
  if (noteMatch) {
    const noteId = decodeURIComponent(noteMatch[1])
    // Daily and weekly notes are entered via the sidebar's Calendar nav —
    // treat them as root (they reset the trail) so the breadcrumb starts
    // fresh under "Calendar" instead of inheriting whatever section the
    // user came from (Tasks, People, etc).
    if (isValidDateString(noteId) || isValidWeekString(noteId)) {
      return { path: p, title, iconKind: "route", iconRef: "calendar" }
    }
    return { path: p, title, iconKind: "note", iconRef: noteId }
  }

  // Specific tag: /tags/$tag
  const tagMatch = p.match(/^\/tags\/(.+)$/)
  if (tagMatch) {
    return { path: p, title, iconKind: "tag", iconRef: decodeURIComponent(tagMatch[1]) }
  }

  // Root list views
  if (p in ROOT_ROUTE_ICONS) {
    return { path: p, title, iconKind: "route", iconRef: ROOT_ROUTE_ICONS[p]! }
  }

  // Anything else (unknown whitelist miss) — fall back to tab icon if provided
  if (icon) {
    return { path: p, title, iconKind: "route", iconRef: icon }
  }
  return null
}

/**
 * Apply the breadcrumb navigation rules to a tab's trail:
 * 1. Destination blacklisted → trail untouched (returns the same trail).
 * 2. Destination is a ROOT route (sidebar section like /projects, /notes) →
 *    reset trail to [segment]. Root navigation is always a fresh start —
 *    the breadcrumb grows FROM a section as the user drills in.
 * 3. Destination already in trail → truncate up to and including that segment.
 * 4. Destination === last segment (same path) → no change.
 * 5. Destination is new → push at end.
 */
function applyTrailRules(
  currentTrail: TrailSegment[] | undefined,
  next: TrailSegment | null,
): TrailSegment[] {
  const trail = currentTrail ?? []
  if (next === null) return trail
  // Rule 2: root routes reset the trail. computeTrailSegment tags these
  // with iconKind === "route" (the top-level sidebar sections).
  if (next.iconKind === "route") return [next]
  const existing = trail.findIndex((s) => s.path === next.path)
  if (existing !== -1) {
    // Truncate to the revisited segment (replace its title/icon in case they changed)
    return [...trail.slice(0, existing), next]
  }
  return [...trail, next]
}

export function useTabs() {
  const [tabs, setTabs] = useAtom(openTabsAtom)
  const [defaultTrail, setDefaultTrail] = useAtom(defaultTrailAtom)
  const router = useRouter()

  // Derive active tab path from current route
  const currentPath = normalizePath(router.state.location.pathname)

  const activeTabIndex = tabs.findIndex((t) => normalizePath(t.path) === currentPath)

  /**
   * Create a NEW tab (explicit action: Cmd+T, +button, Cmd+click).
   * If a tab for this path already exists, just switch to it.
   * New tabs start with a fresh trail — they do NOT inherit the originating
   * tab's trail.
   */
  const openTab = (path: string, title: string, icon?: Tab["icon"]) => {
    const normalized = normalizePath(path)
    const segment = computeTrailSegment(normalized, title, icon)
    const freshTrail = segment ? [segment] : []
    setTabs((prev) => {
      if (prev.some((t) => normalizePath(t.path) === normalized)) {
        return prev.map((t) =>
          normalizePath(t.path) === normalized ? { ...t, title, icon, trail: freshTrail } : t,
        )
      }
      return [...prev, { path: normalized, title, icon, trail: freshTrail }]
    })
  }

  /**
   * Update the current active tab to show a different page.
   * This is for normal navigation — NOT for creating new tabs.
   * Applies the breadcrumb trail rules to the active tab's trail (or to
   * the default trail if no tabs exist — so the breadcrumb works for
   * users who never explicitly open tabs).
   */
  const updateActiveTab = (path: string, title: string, icon?: Tab["icon"]) => {
    const normalized = normalizePath(path)
    const segment = computeTrailSegment(normalized, title, icon)

    setTabs((prev) => {
      // Helper: build the next trail for a tab given its current trail
      const nextTrail = (t: Tab) => applyTrailRules(t.trail, segment)

      // If this path already has a tab, update title/icon + advance its trail
      if (prev.some((t) => normalizePath(t.path) === normalized)) {
        return prev.map((t) =>
          normalizePath(t.path) === normalized ? { ...t, title, icon, trail: nextTrail(t) } : t,
        )
      }

      // If no tabs exist, leave tabs alone — the default trail is updated
      // below instead, so the breadcrumb still works.
      if (prev.length === 0) {
        return prev
      }

      // Replace the active tab with the new page, extending its trail
      if (activeTabIndex >= 0) {
        return prev.map((t, i) =>
          i === activeTabIndex ? { path: normalized, title, icon, trail: nextTrail(t) } : t,
        )
      }

      // Fallback: replace the last tab
      return prev.map((t, i) =>
        i === prev.length - 1 ? { path: normalized, title, icon, trail: nextTrail(t) } : t,
      )
    })

    // Always keep the default trail advanced too. When no tabs exist this
    // is the only trail shown; when tabs exist it's harmless and lets the
    // app fall back cleanly if the user closes all tabs.
    setDefaultTrail((prev) => applyTrailRules(prev, segment))
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

  // When there's an active tab, its trail wins. Otherwise fall back to the
  // global default trail so the breadcrumb still works without explicit tabs.
  const activeTrail =
    activeTabIndex >= 0 ? (tabs[activeTabIndex].trail ?? defaultTrail) : defaultTrail

  return {
    tabs,
    activeTabIndex,
    activeTrail,
    currentPath,
    openTab,
    updateActiveTab,
    closeTab,
    closeOtherTabs,
    closeAllTabs,
  }
}
