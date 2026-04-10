# Phase 3: Status Dashboard — Design Spec

## Overview

A "morning briefing" dashboard that replaces the Home (`/`) route conditionally. When there are actionable items (unprocessed inbox, today's tasks, urgent tasks), the user sees an actionable summary. When everything is clear, they see the normal notes list.

## Conditional Home Logic

The `/` route renders either `DashboardView` or the existing notes list:

- **Show Dashboard** when ANY of these are true:
  - Unprocessed inbox items > 0
  - Today's daily note has incomplete tasks
  - Any task has priority 1 or 2
- **Show Notes list** (current behavior) when none of the above are true

Navigation between views:
- Dashboard shows a "Ver notas →" link at the bottom
- Notes list shows a subtle banner "Tienes X pendientes →" at the top when dashboard conditions are met (user navigated away manually)

## Dashboard Sections

### 1. Greeting / AI Summary

A personalized paragraph summarizing the day's status, with inline emoji icons for visual scanning.

**With AI key configured:** Generate a natural-language paragraph via OpenAI/Claude using the day's data as context. The prompt includes counts of inbox items, today's tasks, urgent tasks, active projects, and their progress.

**Without AI key (template fallback):** Pick a random template from a pool of ~8 variants. Templates use inline icons matching the reference design style:

```
"Buenos días. Tienes 📥 {inbox} items en inbox, ☑️ {tasks} tareas para hoy y 📁 {projects} proyectos activos."

"Hoy: 📥 {inbox} por procesar, ☑️ {tasks} pendientes. {topProject} está al {progress}%."

"Tu día: 🔴 {urgentTasks} urgentes, 📥 {inbox} en inbox. 📁 {topProject} avanza con {completed}/{total} tareas."

"Good morning. You have 📥 {inbox} inbox items, ☑️ {tasks} tasks today and 📁 {projects} active projects."

"{greeting}. 📥 {inbox} to process, ☑️ {tasks} tasks due today. {urgentTasks} are 🔴 urgent."

"Resumen: 📁 {projects} proyectos activos, ☑️ {todayCompleted} tareas completadas hoy. {inbox} 📥 pendientes en inbox."

"{greeting}. All quiet — just 📥 {inbox} inbox items and ☑️ {tasks} tasks on your plate."

"Hoy tienes ☑️ {tasks} tareas. Tu proyecto más activo es 📁 {topProject} ({progress}%). 📥 {inbox} en inbox."
```

`{greeting}` resolves to time-of-day greeting (Buenos días / Buenas tardes / Good morning / Good afternoon) based on locale detection from note content.

Templates are selected randomly on each render but seeded by the date so the same template shows consistently throughout the day.

### 2. Inbox (unprocessed)

- Header: "📥 Inbox" with count badge
- Compact list of first 3 unprocessed items showing `friendlyTitle`
- Each item is a link to `/notes/{id}`
- "Procesar inbox →" button links to `/inbox`
- Hidden when count is 0

### 3. Today's Tasks

- Header: "☑️ Hoy" with date
- Interactive checkboxes from today's daily note
- Checking a box toggles the task in the actual daily note content (same mechanism as task-list component)
- Shows task text with wikilinks rendered as display names
- "Ver nota del día →" link to today's daily note
- Hidden when no daily note exists or all tasks are complete

### 4. Urgent Tasks

- Header: "🔴 Urgentes"
- Tasks with `priority: 1` or `priority: 2` from any note
- Each shows: checkbox, task text, source note name (as link)
- Priority 1 items shown with red indicator, priority 2 with yellow
- Hidden when no urgent tasks exist

### 5. Active Projects

- Header: "📁 Proyectos"
- Only projects with `status: active`
- Each shows: project name (link), status badge with color, progress bar (completed/total tasks), owner if set
- Progress bar is a simple CSS bar (bg-bg-tertiary track, bg-text-success fill)
- Hidden when no active projects exist

### 6. Recent Notes

- Header: "🕐 Recientes"
- Last 5 notes edited, excluding: daily notes, weekly notes, inbox items, templates
- Shows: note title (link), relative time ("hace 2h", "yesterday")
- Always visible (there are always recent notes)

## Architecture

### Files

| File | Purpose |
|------|---------|
| `src/components/dashboard-view.tsx` | Main dashboard component with all sections |
| `src/utils/dashboard-templates.ts` | Template pool and greeting logic |
| `src/routes/_appRoot.index.tsx` | Modified to conditionally render dashboard or notes list |

### State

New derived atom in `src/global-state.ts`:

```ts
export const shouldShowDashboardAtom = atom((get) => {
  const unprocessedCount = get(unprocessedInboxCountAtom)
  const todayTasks = /* incomplete tasks from today's daily note */
  const urgentTasks = /* tasks with priority 1-2 */
  return unprocessedCount > 0 || todayTasks > 0 || urgentTasks > 0
})
```

The dashboard component reads existing atoms directly:
- `inboxAtom` for unprocessed items
- `notesAtom` for today's daily note and its tasks
- `tasksAtom` for urgent tasks (filter by priority)
- `projectsAtom` for active projects
- `sortedNotesAtom` for recent notes

### AI Summary

Reuses the pattern from `ai-classify.ts`:
- Direct fetch to OpenAI (`gpt-4o-mini`) or Claude (`claude-haiku-4-5`) 
- System prompt includes structured data (counts, project names, task titles)
- Response is a single paragraph, ~2 sentences
- Cached in component state — generated once on mount, not on every render
- Loading state shows the template fallback while AI generates
- Uses `aiProviderAtom`, `openaiKeyAtom`, `claudeApiKeyAtom` from global state

### Task Interaction

Today's tasks checkboxes work by:
1. Reading today's daily note content
2. On toggle, updating the markdown checkbox (`- [ ]` ↔ `- [x]`)
3. Writing back via `WRITE_FILES` event (same as existing task-list behavior)

## What This Does NOT Include

- No charts or graphs
- No persisted dashboard state
- No section configuration (show/hide)
- No nudges (Phase 4)
- No drag-and-drop reordering
