# Phase 1: Entities + Mention Picker — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add Project and Person entity types (as notes with special frontmatter), derived views with routes, sidebar navigation, and a universal mention picker (`@` and `[[` triggers) in the CodeMirror editor.

**Architecture:** Entities are regular markdown notes identified by a `type` field in frontmatter. New Jotai atoms derive project/person lists from the existing `notesAtom`. New routes `/projects` and `/people` follow the same pattern as `/tasks` and `/links`. The mention picker extends the existing CodeMirror autocompletion system to group results by entity type and respond to both `@` and `[[` triggers.

**Tech Stack:** React, TypeScript, Jotai, TanStack Router, CodeMirror 6, Tailwind CSS

---

### Task 1: Extend NoteType to include new entity types

**Files:**

- Modify: `src/schema.ts:5`

- [ ] **Step 1: Update NoteType union**

In `src/schema.ts`, change line 5:

```typescript
// Before:
export type NoteType = "note" | "daily" | "weekly" | "template"

// After:
export type NoteType = "note" | "daily" | "weekly" | "template" | "project" | "person" | "inbox"
```

- [ ] **Step 2: Verify build**

Run: `npm run build 2>&1 | tail -5`
Expected: Build succeeds (no consumers break since NoteType is a union — adding members is safe)

- [ ] **Step 3: Commit**

```bash
git add src/schema.ts
git commit -m "feat: extend NoteType with project, person, inbox types"
```

---

### Task 2: Detect entity types in parseNote

**Files:**

- Modify: `src/utils/parse-note.ts:208-217`

- [ ] **Step 1: Add frontmatter type detection before existing type checks**

In `src/utils/parse-note.ts`, replace the type detection block (lines 208-217):

```typescript
// Before:
// Determine the type of the note
if (isValidDateString(id)) {
  type = "daily"
  // Add the daily note's date to its dates array
  dates.add(id)
} else if (isValidWeekString(id)) {
  type = "weekly"
} else if (templateSchema.omit({ body: true }).safeParse(frontmatter.template).success) {
  type = "template"
}

// After:
// Determine the type of the note
// Frontmatter type field takes priority for entity types
const fmType = frontmatter.type
if (fmType === "project" || fmType === "person" || fmType === "inbox") {
  type = fmType
} else if (isValidDateString(id)) {
  type = "daily"
  // Add the daily note's date to its dates array
  dates.add(id)
} else if (isValidWeekString(id)) {
  type = "weekly"
} else if (templateSchema.omit({ body: true }).safeParse(frontmatter.template).success) {
  type = "template"
}
```

- [ ] **Step 2: Add displayName handling for new types**

In the same file, in the `switch (type)` block (lines 219-252), add cases before the closing of the switch:

```typescript
    case "project":
      displayName = title ? removeLeadingEmoji(title) : id
      break
    case "person":
      displayName = title ? removeLeadingEmoji(title) : id
      break
    case "inbox":
      displayName = title ? removeLeadingEmoji(title) : `Inbox ${id}`
      break
```

Add these cases after the `case "template":` block and before `case "note":`.

- [ ] **Step 3: Verify build**

Run: `npm run build 2>&1 | tail -5`
Expected: Build succeeds

- [ ] **Step 4: Commit**

```bash
git add src/utils/parse-note.ts
git commit -m "feat: detect project/person/inbox types from frontmatter"
```

---

### Task 3: Add derived atoms for projects and people

**Files:**

- Modify: `src/global-state.ts` (after templatesAtom block, ~line 839)

- [ ] **Step 1: Add projectsAtom**

After the templates section (after line 839), add:

```typescript
// -----------------------------------------------------------------------------
// Projects
// -----------------------------------------------------------------------------

export const projectsAtom = atom((get) => {
  const notes = get(notesAtom)
  const projects: Note[] = []

  for (const note of notes.values()) {
    if (note.type === "project") {
      projects.push(note)
    }
  }

  // Sort by priority (ascending, nulls last), then by displayName
  return projects.sort((a, b) => {
    const pa = (a.frontmatter.priority as number) ?? 99
    const pb = (b.frontmatter.priority as number) ?? 99
    if (pa !== pb) return pa - pb
    return a.displayName.localeCompare(b.displayName)
  })
})

export const projectSearcherAtom = atom((get) => {
  const projects = get(projectsAtom)
  return new Searcher(projects, {
    keySelector: (p) => [p.displayName, p.id],
    threshold: 0.8,
  })
})

// -----------------------------------------------------------------------------
// People
// -----------------------------------------------------------------------------

export const peopleAtom = atom((get) => {
  const notes = get(notesAtom)
  const people: Note[] = []

  for (const note of notes.values()) {
    if (note.type === "person") {
      people.push(note)
    }
  }

  return people.sort((a, b) => a.displayName.localeCompare(b.displayName))
})

export const personSearcherAtom = atom((get) => {
  const people = get(peopleAtom)
  return new Searcher(people, {
    keySelector: (p) => [p.displayName, p.id],
    threshold: 0.8,
  })
})
```

- [ ] **Step 2: Verify build**

Run: `npm run build 2>&1 | tail -5`
Expected: Build succeeds

- [ ] **Step 3: Commit**

```bash
git add src/global-state.ts
git commit -m "feat: add projectsAtom and peopleAtom derived state"
```

---

### Task 4: Install Lucide React icon library

**Files:**

- Modify: `package.json` (via npm install)

Lucide React is tree-shakeable (only icons you import are bundled), renders at any size, uses `currentColor` by default. We'll use it for all new icons going forward — existing custom SVGs stay as-is.

- [ ] **Step 1: Install lucide-react**

Run: `npm install lucide-react`

- [ ] **Step 2: Verify build**

Run: `npm run build 2>&1 | tail -5`
Expected: Build succeeds

- [ ] **Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: install lucide-react icon library"
```

---

### Task 5: Add Projects and People to sidebar navigation

**Files:**

- Modify: `src/components/nav-items.tsx:134-144`

- [ ] **Step 1: Import Lucide icons**

Add a new import at the top of `src/components/nav-items.tsx`:

```typescript
import { FolderOpen, User } from "lucide-react"
```

- [ ] **Step 2: Add nav links after Tags**

After the Tags `<li>` block (after line 144), add:

```typescript
            <li>
              <NavLink
                to="/projects"
                search={{ query: undefined, view: "list" }}
                icon={<FolderOpen size={16} />}
                onNavigate={onNavigate}
              >
                Projects
              </NavLink>
            </li>
            <li>
              <NavLink
                to="/people"
                search={{ query: undefined, view: "list" }}
                icon={<User size={16} />}
                onNavigate={onNavigate}
              >
                People
              </NavLink>
            </li>
```

- [ ] **Step 3: Verify build**

Run: `npm run build 2>&1 | tail -5`
Expected: Build succeeds (routes don't exist yet but NavLink won't crash — TanStack Router handles unknown routes gracefully at build time if types aren't strict)

- [ ] **Step 4: Commit**

```bash
git add src/components/nav-items.tsx
git commit -m "feat: add Projects and People links to sidebar navigation"
```

---

### Task 6: Create Projects view component

**Files:**

- Create: `src/components/projects-view.tsx`

- [ ] **Step 1: Create the component**

Create `src/components/projects-view.tsx`:

```typescript
import { useAtomValue } from "jotai"
import React, { useDeferredValue, useMemo, useState } from "react"
import { Link } from "@tanstack/react-router"
import { projectsAtom } from "../global-state"
import { SearchInput } from "./search-input"
import { DropdownMenu } from "./dropdown-menu"
import { IconButton } from "./icon-button"
import { GridIcon16, ListIcon16 } from "./icons"
import type { Note } from "../schema"

type ProjectsViewProps = {
  query: string
  view: "grid" | "list"
  onQueryChange: (query: string) => void
  onViewChange: (view: "grid" | "list") => void
}

export function ProjectsView({ query, view, onQueryChange, onViewChange }: ProjectsViewProps) {
  const projects = useAtomValue(projectsAtom)
  const deferredQuery = useDeferredValue(query)

  const filteredProjects = useMemo(() => {
    if (!deferredQuery) return projects
    const lower = deferredQuery.toLowerCase()
    return projects.filter(
      (p) =>
        p.displayName.toLowerCase().includes(lower) ||
        p.id.toLowerCase().includes(lower) ||
        (typeof p.frontmatter.status === "string" &&
          p.frontmatter.status.toLowerCase().includes(lower)),
    )
  }, [projects, deferredQuery])

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2">
        <SearchInput
          placeholder={`Search ${filteredProjects.length} projects…`}
          value={query}
          onChange={onQueryChange}
        />
        <DropdownMenu>
          <DropdownMenu.Trigger
            render={<IconButton>{view === "grid" ? <GridIcon16 /> : <ListIcon16 />}</IconButton>}
          />
          <DropdownMenu.Content align="end" width={160}>
            <DropdownMenu.Item selected={view === "grid"} onClick={() => onViewChange("grid")}>
              Grid
            </DropdownMenu.Item>
            <DropdownMenu.Item selected={view === "list"} onClick={() => onViewChange("list")}>
              List
            </DropdownMenu.Item>
          </DropdownMenu.Content>
        </DropdownMenu>
      </div>
      {filteredProjects.length === 0 ? (
        <div className="text-text-secondary text-sm">
          {projects.length === 0
            ? "No projects yet. Create a note with type: project in frontmatter."
            : "No projects match your search."}
        </div>
      ) : (
        <ul className="flex flex-col gap-0.5">
          {filteredProjects.map((project) => (
            <ProjectListItem key={project.id} project={project} />
          ))}
        </ul>
      )}
    </div>
  )
}

function ProjectListItem({ project }: { project: Note }) {
  const status = (project.frontmatter.status as string) ?? "active"
  const owner = project.frontmatter.owner as string | undefined
  const deadline = project.frontmatter.deadline as string | undefined
  const totalTasks = project.tasks.length
  const completedTasks = project.tasks.filter((t) => t.completed).length

  return (
    <li>
      <Link
        to="/notes/$"
        params={{ _splat: project.id }}
        search={{ mode: "read", query: undefined, view: "grid" }}
        className="nav-item flex items-center justify-between gap-3 rounded px-2 py-1.5"
      >
        <div className="flex flex-col gap-0.5 overflow-hidden">
          <span className="truncate font-medium">{project.displayName}</span>
          <div className="flex items-center gap-2 text-xs text-text-secondary">
            <StatusBadge status={status} />
            {owner ? <span>{owner.replace(/\[\[|\]\]/g, "")}</span> : null}
            {deadline ? <span>Due {deadline}</span> : null}
          </div>
        </div>
        {totalTasks > 0 ? (
          <span className="shrink-0 text-xs text-text-secondary">
            {completedTasks}/{totalTasks}
          </span>
        ) : null}
      </Link>
    </li>
  )
}

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    active: "text-text-success",
    paused: "text-text-pending",
    completed: "text-text-secondary",
    cancelled: "text-text-danger",
  }
  return <span className={colors[status] ?? "text-text-secondary"}>● {status}</span>
}
```

- [ ] **Step 2: Verify build**

Run: `npm run build 2>&1 | tail -5`
Expected: Build succeeds

- [ ] **Step 3: Commit**

```bash
git add src/components/projects-view.tsx
git commit -m "feat: create ProjectsView component"
```

---

### Task 7: Create Projects route

**Files:**

- Create: `src/routes/_appRoot.projects.tsx`

- [ ] **Step 1: Create the route file**

Create `src/routes/_appRoot.projects.tsx`:

```typescript
import { createFileRoute } from "@tanstack/react-router"
import { FolderOpen } from "lucide-react"
import { PageLayout } from "../components/page-layout"
import { ProjectsView } from "../components/projects-view"

type RouteSearch = {
  query: string | undefined
  view: "grid" | "list"
}

export const Route = createFileRoute("/_appRoot/projects")({
  validateSearch: (search: Record<string, unknown>): RouteSearch => {
    return {
      query: typeof search.query === "string" ? search.query : undefined,
      view: search.view === "grid" ? "grid" : "list",
    }
  },
  component: RouteComponent,
  head: () => ({
    meta: [{ title: "Projects · Lumen" }],
  }),
})

function RouteComponent() {
  const { query, view } = Route.useSearch()
  const navigate = Route.useNavigate()

  return (
    <PageLayout title="Projects" icon={<FolderOpen size={16} />}>
      <div className="p-4 pt-0">
        <ProjectsView
          query={query ?? ""}
          view={view}
          onQueryChange={(query) =>
            navigate({ search: (prev) => ({ ...prev, query }), replace: true })
          }
          onViewChange={(view) =>
            navigate({ search: (prev) => ({ ...prev, view }), replace: true })
          }
        />
      </div>
    </PageLayout>
  )
}
```

- [ ] **Step 2: Verify build**

Run: `npm run build 2>&1 | tail -5`
Expected: Build succeeds. TanStack Router auto-generates route types.

- [ ] **Step 3: Commit**

```bash
git add src/routes/_appRoot.projects.tsx
git commit -m "feat: add /projects route"
```

---

### Task 8: Create People view component

**Files:**

- Create: `src/components/people-view.tsx`

- [ ] **Step 1: Create the component**

Create `src/components/people-view.tsx`:

```typescript
import { useAtomValue } from "jotai"
import React, { useDeferredValue, useMemo } from "react"
import { Link } from "@tanstack/react-router"
import { peopleAtom, tasksAtom } from "../global-state"
import { SearchInput } from "./search-input"
import { DropdownMenu } from "./dropdown-menu"
import { IconButton } from "./icon-button"
import { GridIcon16, ListIcon16 } from "./icons"
import type { Note } from "../schema"

type PeopleViewProps = {
  query: string
  view: "grid" | "list"
  onQueryChange: (query: string) => void
  onViewChange: (view: "grid" | "list") => void
}

export function PeopleView({ query, view, onQueryChange, onViewChange }: PeopleViewProps) {
  const people = useAtomValue(peopleAtom)
  const allTasks = useAtomValue(tasksAtom)
  const deferredQuery = useDeferredValue(query)

  const filteredPeople = useMemo(() => {
    if (!deferredQuery) return people
    const lower = deferredQuery.toLowerCase()
    return people.filter(
      (p) =>
        p.displayName.toLowerCase().includes(lower) ||
        p.id.toLowerCase().includes(lower) ||
        (typeof p.frontmatter.role === "string" &&
          p.frontmatter.role.toLowerCase().includes(lower)) ||
        (typeof p.frontmatter.team === "string" &&
          p.frontmatter.team.toLowerCase().includes(lower)),
    )
  }, [people, deferredQuery])

  // Count tasks that reference each person via wikilinks
  const taskCounts = useMemo(() => {
    const counts: Record<string, number> = {}
    for (const person of people) {
      counts[person.id] = allTasks.filter(
        (t) => !t.completed && t.note.links.includes(person.id),
      ).length
    }
    return counts
  }, [people, allTasks])

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2">
        <SearchInput
          placeholder={`Search ${filteredPeople.length} people…`}
          value={query}
          onChange={onQueryChange}
        />
        <DropdownMenu>
          <DropdownMenu.Trigger
            render={<IconButton>{view === "grid" ? <GridIcon16 /> : <ListIcon16 />}</IconButton>}
          />
          <DropdownMenu.Content align="end" width={160}>
            <DropdownMenu.Item selected={view === "grid"} onClick={() => onViewChange("grid")}>
              Grid
            </DropdownMenu.Item>
            <DropdownMenu.Item selected={view === "list"} onClick={() => onViewChange("list")}>
              List
            </DropdownMenu.Item>
          </DropdownMenu.Content>
        </DropdownMenu>
      </div>
      {filteredPeople.length === 0 ? (
        <div className="text-text-secondary text-sm">
          {people.length === 0
            ? "No people yet. Create a note with type: person in frontmatter."
            : "No people match your search."}
        </div>
      ) : (
        <ul className="flex flex-col gap-0.5">
          {filteredPeople.map((person) => (
            <PersonListItem
              key={person.id}
              person={person}
              taskCount={taskCounts[person.id] ?? 0}
            />
          ))}
        </ul>
      )}
    </div>
  )
}

function PersonListItem({ person, taskCount }: { person: Note; taskCount: number }) {
  const role = person.frontmatter.role as string | undefined
  const team = person.frontmatter.team as string | undefined

  return (
    <li>
      <Link
        to="/notes/$"
        params={{ _splat: person.id }}
        search={{ mode: "read", query: undefined, view: "grid" }}
        className="nav-item flex items-center justify-between gap-3 rounded px-2 py-1.5"
      >
        <div className="flex flex-col gap-0.5 overflow-hidden">
          <span className="truncate font-medium">{person.displayName}</span>
          <div className="flex items-center gap-2 text-xs text-text-secondary">
            {role ? <span>{role}</span> : null}
            {team ? <span>· {team}</span> : null}
          </div>
        </div>
        {taskCount > 0 ? (
          <span className="shrink-0 text-xs text-text-secondary">{taskCount} tasks</span>
        ) : null}
      </Link>
    </li>
  )
}
```

- [ ] **Step 2: Verify build**

Run: `npm run build 2>&1 | tail -5`
Expected: Build succeeds

- [ ] **Step 3: Commit**

```bash
git add src/components/people-view.tsx
git commit -m "feat: create PeopleView component"
```

---

### Task 9: Create People route

**Files:**

- Create: `src/routes/_appRoot.people.tsx`

- [ ] **Step 1: Create the route file**

Create `src/routes/_appRoot.people.tsx`:

```typescript
import { createFileRoute } from "@tanstack/react-router"
import { User } from "lucide-react"
import { PageLayout } from "../components/page-layout"
import { PeopleView } from "../components/people-view"

type RouteSearch = {
  query: string | undefined
  view: "grid" | "list"
}

export const Route = createFileRoute("/_appRoot/people")({
  validateSearch: (search: Record<string, unknown>): RouteSearch => {
    return {
      query: typeof search.query === "string" ? search.query : undefined,
      view: search.view === "grid" ? "grid" : "list",
    }
  },
  component: RouteComponent,
  head: () => ({
    meta: [{ title: "People · Lumen" }],
  }),
})

function RouteComponent() {
  const { query, view } = Route.useSearch()
  const navigate = Route.useNavigate()

  return (
    <PageLayout title="People" icon={<User size={16} />}>
      <div className="p-4 pt-0">
        <PeopleView
          query={query ?? ""}
          view={view}
          onQueryChange={(query) =>
            navigate({ search: (prev) => ({ ...prev, query }), replace: true })
          }
          onViewChange={(view) =>
            navigate({ search: (prev) => ({ ...prev, view }), replace: true })
          }
        />
      </div>
    </PageLayout>
  )
}
```

- [ ] **Step 2: Verify build**

Run: `npm run build 2>&1 | tail -5`
Expected: Build succeeds

- [ ] **Step 3: Commit**

```bash
git add src/routes/_appRoot.people.tsx
git commit -m "feat: add /people route"
```

---

### Task 10: Add @ mention trigger to CodeMirror autocompletion

**Files:**

- Modify: `src/components/note-editor.tsx` (~lines 388-446 for useNoteCompletion, ~lines 159-167 for autocompletion config)

- [ ] **Step 1: Create useMentionCompletion hook**

In `src/components/note-editor.tsx`, add a new hook after `useNoteCompletion()` (after ~line 446):

```typescript
function useMentionCompletion() {
  const searchNotes = useStableSearchNotes()
  const projects = useAtomValue(projectsAtom)
  const people = useAtomValue(peopleAtom)

  const mentionCompletion = React.useCallback(
    async (context: CompletionContext): Promise<CompletionResult | null> => {
      const word = context.matchBefore(/@[\w-]*/)

      if (!word) return null

      const query = word.text.slice(1) // Remove @ prefix

      // Build grouped options: People first, then Projects, then Notes
      const options: Completion[] = []

      // People matches
      const matchedPeople = people
        .filter(
          (p) =>
            !query ||
            p.displayName.toLowerCase().includes(query.toLowerCase()) ||
            p.id.toLowerCase().includes(query.toLowerCase()),
        )
        .slice(0, 5)

      for (const person of matchedPeople) {
        const linkText = person.alias || person.displayName
        options.push({
          label: person.displayName,
          detail: "person",
          apply: (view, completion, from, to) => {
            insertWikilink({ view, from, to, noteId: person.id, label: linkText })
          },
        })
      }

      // Project matches
      const matchedProjects = projects
        .filter(
          (p) =>
            !query ||
            p.displayName.toLowerCase().includes(query.toLowerCase()) ||
            p.id.toLowerCase().includes(query.toLowerCase()),
        )
        .slice(0, 5)

      for (const project of matchedProjects) {
        const linkText = project.alias || project.displayName
        options.push({
          label: project.displayName,
          detail: "project",
          apply: (view, completion, from, to) => {
            insertWikilink({ view, from, to, noteId: project.id, label: linkText })
          },
        })
      }

      // General note matches (exclude people/projects already shown)
      const shownIds = new Set([
        ...matchedPeople.map((p) => p.id),
        ...matchedProjects.map((p) => p.id),
      ])
      const noteResults = searchNotes(query)
        .filter((n) => !shownIds.has(n.id))
        .slice(0, 5)

      for (const note of noteResults) {
        const linkText = note.alias || note.displayName
        options.push({
          label: note.displayName,
          detail: "note",
          apply: (view, completion, from, to) => {
            insertWikilink({ view, from, to, noteId: note.id, label: linkText })
          },
        })
      }

      if (options.length === 0) return null

      return {
        from: word.from,
        options,
        filter: false,
      }
    },
    [searchNotes, projects, people],
  )

  return mentionCompletion
}
```

- [ ] **Step 2: Import required atoms**

Add to the imports at the top of `src/components/note-editor.tsx`:

```typescript
import { projectsAtom, peopleAtom } from "../global-state"
```

(Add these to the existing import from `"../global-state"`)

- [ ] **Step 3: Register the completion in the extensions array**

In the component where `autocompletion()` is configured (~line 159), add `mentionCompletion` to the override array:

First, add the hook call near the other completion hooks (~line 145):

```typescript
const mentionCompletion = useMentionCompletion()
```

Then add it to the `override` array in `autocompletion()`:

```typescript
autocompletion({
  override: [
    dateCompletion,
    noteCompletion,
    mentionCompletion,  // Add this line
    tagSyntaxCompletion,
    tagPropertyCompletion,
    templateCompletion,
  ],
  icons: false,
}),
```

Also add `mentionCompletion` to the dependency array of the `useMemo` that creates the extensions array.

- [ ] **Step 4: Verify build**

Run: `npm run build 2>&1 | tail -5`
Expected: Build succeeds

- [ ] **Step 5: Commit**

```bash
git add src/components/note-editor.tsx
git commit -m "feat: add @ mention trigger with grouped entity picker"
```

---

### Task 11: Enhance [[ completion with entity type grouping

**Files:**

- Modify: `src/components/note-editor.tsx` (~lines 388-446, `useNoteCompletion`)

- [ ] **Step 1: Update useNoteCompletion to show type labels**

In the existing `useNoteCompletion()` function, modify the completion mapping to include entity type in the `detail` field. Find the section that maps search results to options (~line 420-430):

```typescript
// Before:
const options = searchResults.slice(0, 5).map((note): Completion => {
  const linkText = note.alias || note.displayName
  return {
    label: note.displayName,
    detail: linkText !== note.displayName ? linkText : undefined,
    apply: (view, completion, from, to) => {
      insertWikilink({ view, from, to, noteId: note.id, label: linkText })
    },
  }
})

// After:
const typeLabels: Record<string, string> = {
  person: "person",
  project: "project",
  daily: "daily",
  weekly: "weekly",
  template: "template",
}
const options = searchResults.slice(0, 10).map((note): Completion => {
  const linkText = note.alias || note.displayName
  return {
    label: note.displayName,
    detail: typeLabels[note.type] ?? undefined,
    apply: (view, completion, from, to) => {
      insertWikilink({ view, from, to, noteId: note.id, label: linkText })
    },
  }
})
```

- [ ] **Step 2: Verify build**

Run: `npm run build 2>&1 | tail -5`
Expected: Build succeeds

- [ ] **Step 3: Commit**

```bash
git add src/components/note-editor.tsx
git commit -m "feat: show entity type labels in wikilink completion"
```

---

### Task 12: Format, lint, and full verification

**Files:** All modified files

- [ ] **Step 1: Format**

Run: `npm run format`

- [ ] **Step 2: Lint**

Run: `npm run lint`
Expected: No errors

- [ ] **Step 3: Build**

Run: `npm run build 2>&1 | tail -10`
Expected: Build succeeds

- [ ] **Step 4: Manual testing with tauri:dev**

Run: `npm run tauri:dev`

Test checklist:

1. Create a note with frontmatter `type: project`, `status: active` — verify it appears in `/projects`
2. Create a note with frontmatter `type: person`, `role: Engineer` — verify it appears in `/people`
3. Sidebar shows Projects and People links
4. Type `@` in editor — verify picker shows people, projects, and notes
5. Type `[[` in editor — verify completions show entity type labels
6. Select a person from `@` picker — verify `[[person-id|Name]]` is inserted
7. Search works on both `/projects` and `/people` pages

- [ ] **Step 5: Final commit with format changes**

```bash
npm run format
git add -A
git commit -m "chore: format and lint cleanup"
```
