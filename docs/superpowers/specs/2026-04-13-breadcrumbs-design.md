# Breadcrumb Navigation — Design Spec

**Status:** approved, ready for implementation plan
**Target version:** v0.6.0 (MINOR — user-visible feature)

## Context

Lumen is a flat graph of notes — there is no native parent-child page nesting like Notion. Users navigate through **category views** (Projects, Tags, People, Inbox) into **specific items**, and through **wikilinks** between notes. Today, once you've navigated 2–3 hops deep, the only way back is the `←` arrow in the titlebar, which navigates one step at a time without showing where you've been.

The user wants a Notion-style breadcrumb — a horizontal trail of clickable segments leading to the current view — so they can:

- See at a glance where they came from
- Jump back to any intermediate step with one click
- Get a stable sense of "location" even in a flat graph

**Motivating cases:**

1. Tags view → click `#engineering` → click a specific note. Want to go back to the tag list, then further back to all tags.
2. Projects list → open a project → click a linked person's wikilink. Want to see the trail `Projects / Project X / Person Y`.
3. Open a note, follow a wikilink to another note, then another. Want the trail of notes so you can backtrack.

## Approach: navigation-history with filters

The user considered a "parent hierarchy from frontmatter" model (`parent:` field, or inferring from `project:` / `team:`). It was ruled out: it requires manual metadata maintenance, fails for notes without that metadata (empty breadcrumb), and doesn't cover the wikilink-between-notes case which isn't hierarchical at all.

Instead, the breadcrumb is driven by **actual navigation history per tab**, filtered so only meaningful routes become segments. This covers every motivating case without requiring any note-level metadata.

## Data model

Each `Tab` in `global-state.ts` gets a new `trail` field:

```ts
type TrailSegment = {
  path: string // "/projects" | "/notes/foo" | "/tags/engineering"
  title: string // "Projects" | "Design Managers" | "#engineering"
  iconKind: "route" | "note" | "tag"
  iconId?: string // note id for "note", tag string for "tag", route key for "route"
}

type Tab = {
  path: string
  title: string
  icon?: string
  trail: TrailSegment[] // always terminates with the current segment
}
```

Trail persistence piggybacks on the existing `atomWithStorage` for tabs — it survives app restarts.

## Routes that enter the trail

**Whitelist** (enter the trail):

- `/notes` — Notes list
- `/notes/$id` — specific note (including daily notes like `/notes/2026-04-13`)
- `/projects` — Projects list
- `/people` — People list
- `/tasks` — Tasks list
- `/links` — Links list
- `/inbox` — Inbox
- `/tags` — Tags list
- `/tags/$tag` — specific tag

**Blacklist** (never enter the trail):

- `/` (Home) — Home is a dashboard, not a page you "come from"
- `/settings` and subpaths — chrome
- `/quick-note` — separate window

## Navigation rules

On every successful route change, a `usePushTrail()` hook applies these rules against the active tab's `trail`:

1. **Destination is blacklisted** → trail untouched; breadcrumb simply doesn't render on this view.
2. **Destination already exists in the trail** → truncate the trail up to (and including) that segment. This handles back button, clicking a breadcrumb segment, and revisiting a prior note via wikilink.
3. **Destination equals the current segment** → no change.
4. **Destination is new** → push at the end.

**Cap and truncation for display:**

- Data layer keeps the full trail (no limit).
- Render layer collapses to `[first] / … / [last 3]` when segment count > 5.
- The `…` is a dropdown that lists the hidden middle segments.

## Tab interactions

- **Cmd+T** / **Cmd+click** → new tab starts with `trail: [segmentoInicial]`. New tab has a fresh trail; it does not inherit the originating tab's trail.
- **Close tab** → trail discarded with the tab.
- **Fresh launch** → persisted tabs restore with their persisted trails. Tabs saved pre-feature (`trail === undefined`) initialize to `[currentSegment]` if the path is whitelisted, else `[]`.

## Special navigation sources

- **Browser back/forward arrows** (`router.history.back()` in the titlebar) — triggers rule 2 (already in trail → truncate). Behavior consistent with clicking a segment.
- **Command menu selection** — treated as normal navigation; applies the rules.
- **Wikilink click within a note** — navigates normally; applies the rules. Typically pushes a new segment (unless the target was already in the trail).
- **Cmd+click on a wikilink** — opens in new tab with fresh trail.
- **Quick Note save** — navigates the main window to `/notes/$id`; applies rules normally in the main window's active tab.
- **Mode toggle** (read ↔ write on a note) — search param change only, same path. No trail change.

## Rendering

**Placement:** replaces the existing `<PageHeader>` at the top of view content (currently renders as `[icon] [title]`). The breadcrumb sits in the same slot, same margins, same height.

**Style — Notion-style "equal segments, current in bold":**

```
[📄 Notes] / [👥 Design Managers] / [📝 Libby Novacheck]
```

- All segments: same font size as the current page title (e.g., `text-xl`).
- Past segments: `text-text-secondary hover:text-text hover:bg-bg-hover` with `rounded` padding, rendered as `<Link>`.
- Current segment (last): `text-text font-medium`, rendered as `<span>` (not a link).
- Separator: plain `/` character, `text-text-tertiary`, padding `px-1.5` around it.
- Icon per segment at 14–16px, left of the label.
- Labels cap at `max-w-[180px] truncate` so long titles don't break the layout.
- Whole row is `select-none` (matches the native-feel chrome polish).

**Icon resolution** — a small helper `<BreadcrumbIcon segment={seg}>`:

- `iconKind === "route"` → Lucide icon from a static map (`/projects` → `FolderOpen`, `/tags` → `Tag`, etc).
- `iconKind === "note"` → existing `<NoteFavicon>` component, resolves from `noteId`.
- `iconKind === "tag"` → Lucide `Hash` with the tag name.

**Empty states:**

- `trail.length === 0` (blacklisted route) → component returns `null`. No layout space reserved.
- `trail.length === 1` → render that single segment. Same visual as today's `<PageHeader>`.
- `trail.length > 1` → render with separators, collapse middle if > 5 segments.

**Unresolved notes** (note id in trail not yet loaded in `notesAtom`) → fall back to path raw (`/notes/xyz` → render label "xyz") until the note loads.

## Keyboard accessibility

- Each clickable segment is a `<Link>`, focusable via Tab.
- Enter on a focused segment triggers click (navigate + truncate).
- No new global shortcut for "breadcrumb up" — the titlebar's `←` button already covers that need.

## Files affected

| File                                 | Change                                                                                  |
| ------------------------------------ | --------------------------------------------------------------------------------------- |
| `src/global-state.ts`                | Add `trail: TrailSegment[]` to `Tab` type; migration for persisted tabs without it      |
| `src/hooks/use-tabs.ts`              | Update `openTab` / `updateActiveTab` to initialize/extend `trail`                       |
| `src/hooks/use-push-trail.ts`        | **NEW** — route-change hook applying the 4 rules                                        |
| `src/components/breadcrumb.tsx`      | **NEW** — renders the trail with icons, separators, truncation                          |
| `src/components/breadcrumb-icon.tsx` | **NEW** — resolves icon per segment kind                                                |
| `src/components/page-header.tsx`     | Replace title with `<Breadcrumb>` when trail is available; fall back to title otherwise |
| `src/routes/_appRoot.tsx`            | Wire `usePushTrail()` at app-root level so it runs on every route change                |

## Non-goals for this iteration

- Persistent cross-tab trail (e.g., "show trail from the tab I just closed")
- Parent-hierarchy mode from frontmatter — ruled out in design
- Keyboard shortcut like "Cmd+↑" to navigate up the trail
- Animated transitions between trail changes (enter/exit animations for segments)

## Verification

**Unit tests** for `usePushTrail` rules:

- Pushes new segment on whitelist navigation
- Truncates trail when navigating to an already-present segment
- Leaves trail untouched on blacklist navigation
- Initializes fresh trail for new tabs
- Migration: undefined trail → initialized to current segment (or empty)

**Manual test plan:**

- Open Projects → click a project → wikilink to a person → breadcrumb shows `Projects / Project X / Person Y`
- Click "Projects" in breadcrumb → navigates to projects list, trail is `[Projects]`
- Cmd+click a wikilink → new tab starts with trail of just the clicked note
- Open /settings → breadcrumb row disappears cleanly
- Return from /settings → previous trail intact
- Navigate 7 levels deep → middle collapses with `…`, dropdown shows hidden steps
- Restart app → trails persist per tab
- Home → click anywhere → trail starts at that "anywhere", Home never appears as a segment

## Versioning

User-visible new feature → **MINOR** bump: `0.5.0` → `0.6.0`.
