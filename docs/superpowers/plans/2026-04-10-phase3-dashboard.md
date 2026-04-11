# Phase 3: Status Dashboard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a conditional morning-briefing dashboard to the Home route that shows actionable items when there's work to do, and the normal notes list when everything is clear.

**Architecture:** New `DashboardView` component renders 6 sections (greeting, inbox, today's tasks, urgent tasks, projects, recent notes). A `shouldShowDashboardAtom` in global state decides whether Home shows the dashboard or the notes list. AI summary uses the same fetch pattern as `ai-classify.ts`. Template fallback uses date-seeded random selection from a pool of ~8 variants.

**Tech Stack:** React 18, Jotai atoms, TanStack Router, Tailwind CSS, Lucide React, OpenAI/Claude APIs

---

## File Map

| File                                | Purpose                                                                                 |
| ----------------------------------- | --------------------------------------------------------------------------------------- |
| `src/utils/dashboard-templates.ts`  | **Create** — Template pool, greeting logic, date-seeded random                          |
| `src/utils/dashboard-ai.ts`         | **Create** — AI summary generation (OpenAI/Claude fetch)                                |
| `src/components/dashboard-view.tsx` | **Create** — Main dashboard with all 6 sections                                         |
| `src/global-state.ts`               | **Modify** — Add `shouldShowDashboardAtom` + `urgentTasksAtom` + `todayIncompleteTasks` |
| `src/routes/_appRoot.index.tsx`     | **Modify** — Conditional render: dashboard or notes list                                |

---

### Task 1: Dashboard templates utility

**Files:**

- Create: `src/utils/dashboard-templates.ts`

- [ ] **Step 1: Create the template utility**

```ts
// src/utils/dashboard-templates.ts

type DashboardData = {
  inbox: number
  tasks: number
  todayCompleted: number
  urgentTasks: number
  projects: number
  topProject: string | null
  topProjectProgress: string | null
}

const greetings = {
  morning: ["Buenos días", "Good morning"],
  afternoon: ["Buenas tardes", "Good afternoon"],
  evening: ["Buenas noches", "Good evening"],
}

function getGreeting(): string {
  const hour = new Date().getHours()
  const pool = hour < 12 ? greetings.morning : hour < 18 ? greetings.afternoon : greetings.evening
  return pool[Math.floor(Math.random() * pool.length)]
}

type TemplateFunction = (data: DashboardData, greeting: string) => string

const templates: TemplateFunction[] = [
  (d, g) =>
    `${g}. Tienes 📥 ${d.inbox} items en inbox, ☑️ ${d.tasks} tareas para hoy y 📁 ${d.projects} proyectos activos.`,
  (d, g) =>
    `${g}. 📥 ${d.inbox} por procesar, ☑️ ${d.tasks} pendientes.${d.topProject ? ` ${d.topProject} está al ${d.topProjectProgress}.` : ""}`,
  (d, g) =>
    `Tu día: 🔴 ${d.urgentTasks} urgentes, 📥 ${d.inbox} en inbox.${d.topProject ? ` 📁 ${d.topProject} avanza con ${d.topProjectProgress}.` : ""}`,
  (d, g) =>
    `${g}. You have 📥 ${d.inbox} inbox items, ☑️ ${d.tasks} tasks today and 📁 ${d.projects} active projects.`,
  (d, g) =>
    `${g}. 📥 ${d.inbox} to process, ☑️ ${d.tasks} tasks due today.${d.urgentTasks > 0 ? ` ${d.urgentTasks} are 🔴 urgent.` : ""}`,
  (d, g) =>
    `Resumen: 📁 ${d.projects} proyectos activos, ☑️ ${d.todayCompleted} tareas completadas hoy. ${d.inbox} 📥 pendientes en inbox.`,
  (d) =>
    d.tasks + d.inbox <= 2
      ? `Todo tranquilo — solo 📥 ${d.inbox} en inbox y ☑️ ${d.tasks} tareas pendientes.`
      : `Hoy tienes ☑️ ${d.tasks} tareas.${d.topProject ? ` Tu proyecto más activo es 📁 ${d.topProject} (${d.topProjectProgress}).` : ""} 📥 ${d.inbox} en inbox.`,
  (d, g) =>
    `${g}. ${d.urgentTasks > 0 ? `🔴 ${d.urgentTasks} urgente${d.urgentTasks > 1 ? "s" : ""} primero. ` : ""}📥 ${d.inbox} en inbox, ☑️ ${d.tasks} tareas, 📁 ${d.projects} proyectos.`,
]

/** Select a template deterministically based on the date (same template all day) */
function dateSeededIndex(length: number): number {
  const today = new Date()
  const seed = today.getFullYear() * 10000 + (today.getMonth() + 1) * 100 + today.getDate()
  return seed % length
}

export function generateTemplateSummary(data: DashboardData): string {
  const index = dateSeededIndex(templates.length)
  const greeting = getGreeting()
  return templates[index](data, greeting)
}

export type { DashboardData }
```

- [ ] **Step 2: Verify build**

Run: `npm run build`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add src/utils/dashboard-templates.ts
git commit -m "feat: dashboard template utility with date-seeded rotation"
```

---

### Task 2: Dashboard AI summary utility

**Files:**

- Create: `src/utils/dashboard-ai.ts`

- [ ] **Step 1: Create the AI summary utility**

```ts
// src/utils/dashboard-ai.ts

import type { DashboardData } from "./dashboard-templates"

const SYSTEM_PROMPT = `You are generating a brief morning briefing for a personal note-taking app dashboard. Given the user's data, write a single paragraph (2-3 sentences max) summarizing what they need to focus on today. Use emoji icons inline: 📥 for inbox, ☑️ for tasks, 📁 for projects, 🔴 for urgent. Be warm but concise. The user may speak Spanish or English — match the language of project/task names if provided, otherwise default to Spanish.`

function buildUserMessage(
  data: DashboardData,
  projectNames: string[],
  urgentTaskTexts: string[],
): string {
  return JSON.stringify({
    inbox_unprocessed: data.inbox,
    tasks_today: data.tasks,
    tasks_completed_today: data.todayCompleted,
    urgent_tasks: urgentTaskTexts.slice(0, 5),
    active_projects: projectNames.slice(0, 5),
    top_project: data.topProject,
    top_project_progress: data.topProjectProgress,
  })
}

export async function generateAISummary(
  data: DashboardData,
  provider: "openai" | "claude",
  apiKey: string,
  projectNames: string[],
  urgentTaskTexts: string[],
): Promise<string> {
  const userMessage = buildUserMessage(data, projectNames, urgentTaskTexts)

  if (provider === "openai") {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: userMessage },
        ],
        temperature: 0.7,
        max_tokens: 200,
      }),
    })
    if (!response.ok) throw new Error(`OpenAI error: ${response.status}`)
    const result = (await response.json()) as { choices: { message: { content: string } }[] }
    return result.choices[0].message.content.trim()
  }

  // Claude
  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "anthropic-dangerous-direct-browser-access": "true",
    },
    body: JSON.stringify({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 200,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: userMessage }],
    }),
  })
  if (!response.ok) throw new Error(`Claude error: ${response.status}`)
  const result = (await response.json()) as { content: { text: string }[] }
  return result.content[0].text.trim()
}
```

- [ ] **Step 2: Verify build**

Run: `npm run build`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add src/utils/dashboard-ai.ts
git commit -m "feat: dashboard AI summary generation (OpenAI/Claude)"
```

---

### Task 3: Global state atoms for dashboard

**Files:**

- Modify: `src/global-state.ts` (after `unprocessedInboxCountAtom`, around line 924)

- [ ] **Step 1: Add dashboard atoms**

In `src/global-state.ts`, after the `unprocessedInboxCountAtom` (line 924), add:

```ts
// -----------------------------------------------------------------------------
// Dashboard
// -----------------------------------------------------------------------------

/** Tasks with priority 1 or 2 from any note */
export const urgentTasksAtom = atom((get) => {
  const notes = get(notesAtom)
  const urgent: { task: import("./schema").Task; note: Note }[] = []
  for (const note of notes.values()) {
    for (const task of note.tasks) {
      if (!task.completed && (task.priority === 1 || task.priority === 2)) {
        urgent.push({ task, note })
      }
    }
  }
  return urgent.sort((a, b) => (a.task.priority ?? 3) - (b.task.priority ?? 3))
})

/** Incomplete tasks from today's daily note */
export const todayTasksAtom = atom((get) => {
  const notes = get(notesAtom)
  const today = new Date()
  const year = today.getFullYear().toString().padStart(4, "0")
  const month = (today.getMonth() + 1).toString().padStart(2, "0")
  const day = today.getDate().toString().padStart(2, "0")
  const todayId = `${year}-${month}-${day}`
  const dailyNote = notes.get(todayId)
  if (!dailyNote) return { tasks: [] as import("./schema").Task[], noteId: todayId, content: "" }
  return { tasks: dailyNote.tasks, noteId: todayId, content: dailyNote.content }
})

/** Whether the dashboard should show instead of the notes list */
export const shouldShowDashboardAtom = atom((get) => {
  const unprocessed = get(unprocessedInboxCountAtom)
  const { tasks: todayTasks } = get(todayTasksAtom)
  const urgentTasks = get(urgentTasksAtom)
  const incompleteTodayTasks = todayTasks.filter((t) => !t.completed).length
  return unprocessed > 0 || incompleteTodayTasks > 0 || urgentTasks.length > 0
})
```

- [ ] **Step 2: Verify build**

Run: `npm run build`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add src/global-state.ts
git commit -m "feat: add dashboard atoms (urgentTasks, todayTasks, shouldShowDashboard)"
```

---

### Task 4: Dashboard view component

**Files:**

- Create: `src/components/dashboard-view.tsx`

- [ ] **Step 1: Create the dashboard component**

```tsx
// src/components/dashboard-view.tsx

import { useAtomValue, useSetAtom } from "jotai"
import React, { useEffect, useMemo, useState } from "react"
import { Link } from "@tanstack/react-router"
import { Inbox, FolderOpen, Clock } from "lucide-react"
import {
  aiProviderAtom,
  claudeApiKeyAtom,
  globalStateMachineAtom,
  inboxAtom,
  notesAtom,
  openaiKeyAtom,
  projectsAtom,
  sortedNotesAtom,
  todayTasksAtom,
  urgentTasksAtom,
} from "../global-state"
import { generateTemplateSummary, type DashboardData } from "../utils/dashboard-templates"
import { generateAISummary } from "../utils/dashboard-ai"
import { updateTaskCompletion } from "../utils/task"
import { Checkbox } from "./checkbox"
import { Markdown } from "./markdown"
import type { Note, Task } from "../schema"

export function DashboardView() {
  const inboxItems = useAtomValue(inboxAtom)
  const {
    tasks: todayTasks,
    noteId: todayNoteId,
    content: todayContent,
  } = useAtomValue(todayTasksAtom)
  const urgentTasks = useAtomValue(urgentTasksAtom)
  const projects = useAtomValue(projectsAtom)
  const recentNotes = useAtomValue(sortedNotesAtom)
  const notes = useAtomValue(notesAtom)
  const send = useSetAtom(globalStateMachineAtom)

  const aiProvider = useAtomValue(aiProviderAtom)
  const openaiKey = useAtomValue(openaiKeyAtom)
  const claudeKey = useAtomValue(claudeApiKeyAtom)
  const apiKey = aiProvider === "openai" ? openaiKey : claudeKey
  const hasKey = apiKey !== ""

  const unprocessed = useMemo(
    () => inboxItems.filter((item) => item.frontmatter.status === "unprocessed"),
    [inboxItems],
  )

  const activeProjects = useMemo(
    () => projects.filter((p) => p.frontmatter.status === "active"),
    [projects],
  )

  const incompleteTodayTasks = useMemo(() => todayTasks.filter((t) => !t.completed), [todayTasks])

  const completedTodayTasks = useMemo(() => todayTasks.filter((t) => t.completed), [todayTasks])

  const topProject = useMemo(() => {
    if (activeProjects.length === 0) return null
    return activeProjects.reduce(
      (best, p) => (p.tasks.length > best.tasks.length ? p : best),
      activeProjects[0],
    )
  }, [activeProjects])

  const dashboardData: DashboardData = useMemo(
    () => ({
      inbox: unprocessed.length,
      tasks: incompleteTodayTasks.length,
      todayCompleted: completedTodayTasks.length,
      urgentTasks: urgentTasks.length,
      projects: activeProjects.length,
      topProject: topProject?.displayName ?? null,
      topProjectProgress: topProject
        ? `${topProject.tasks.filter((t) => t.completed).length}/${topProject.tasks.length}`
        : null,
    }),
    [
      unprocessed,
      incompleteTodayTasks,
      completedTodayTasks,
      urgentTasks,
      activeProjects,
      topProject,
    ],
  )

  // AI summary
  const [aiSummary, setAiSummary] = useState<string | null>(null)
  const templateSummary = useMemo(() => generateTemplateSummary(dashboardData), [dashboardData])

  useEffect(() => {
    if (!hasKey) return
    const projectNames = activeProjects.map((p) => p.displayName)
    const urgentTexts = urgentTasks.map((u) => u.task.text)
    generateAISummary(
      dashboardData,
      aiProvider as "openai" | "claude",
      apiKey,
      projectNames,
      urgentTexts,
    )
      .then(setAiSummary)
      .catch(() => {})
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const summary = aiSummary ?? templateSummary

  // Toggle today's task
  const toggleTodayTask = (task: Task, completed: boolean) => {
    const todayNote = notes.get(todayNoteId)
    if (!todayNote) return
    const updatedContent = updateTaskCompletion({ content: todayNote.content, task, completed })
    send({ type: "WRITE_FILES", markdownFiles: { [`${todayNoteId}.md`]: updatedContent } })
  }

  // Recent notes (exclude daily, weekly, inbox, templates)
  const recent = useMemo(
    () =>
      recentNotes
        .filter((n) => n.type === "note" || n.type === "project" || n.type === "person")
        .slice(0, 5),
    [recentNotes],
  )

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-6 p-4">
      {/* Greeting */}
      <section>
        <p className="text-lg leading-relaxed">{summary}</p>
      </section>

      {/* Inbox */}
      {unprocessed.length > 0 ? (
        <DashboardSection title="📥 Inbox" count={unprocessed.length}>
          <ul className="flex flex-col gap-1">
            {unprocessed.slice(0, 3).map((item) => (
              <li key={item.id}>
                <Link
                  to="/notes/$"
                  params={{ _splat: item.id }}
                  search={{ mode: "read", query: undefined, view: "grid" }}
                  className="link text-sm"
                >
                  {friendlyTitle(item)}
                </Link>
              </li>
            ))}
          </ul>
          <Link to="/inbox" search={{ query: undefined }} className="link text-sm font-medium">
            Procesar inbox →
          </Link>
        </DashboardSection>
      ) : null}

      {/* Today's tasks */}
      {incompleteTodayTasks.length > 0 ? (
        <DashboardSection title="☑️ Hoy" count={incompleteTodayTasks.length}>
          <ul className="flex flex-col gap-1.5">
            {incompleteTodayTasks.map((task, i) => (
              <li key={i} className="flex items-start gap-2">
                <Checkbox
                  checked={task.completed}
                  onChange={(event) => toggleTodayTask(task, event.target.checked)}
                  className="mt-0.5"
                />
                <span className="text-sm">
                  <Markdown>{renderPreview(task.text)}</Markdown>
                </span>
              </li>
            ))}
          </ul>
          <Link
            to="/notes/$"
            params={{ _splat: todayNoteId }}
            search={{ mode: "read", query: undefined, view: "grid" }}
            className="link text-sm font-medium"
          >
            Ver nota del día →
          </Link>
        </DashboardSection>
      ) : null}

      {/* Urgent tasks */}
      {urgentTasks.length > 0 ? (
        <DashboardSection title="🔴 Urgentes" count={urgentTasks.length}>
          <ul className="flex flex-col gap-1.5">
            {urgentTasks.slice(0, 5).map((u, i) => (
              <li key={i} className="flex items-start gap-2 text-sm">
                <span className={u.task.priority === 1 ? "text-text-danger" : "text-text-pending"}>
                  P{u.task.priority}
                </span>
                <span className="flex-1">{renderPreview(u.task.text)}</span>
                <Link
                  to="/notes/$"
                  params={{ _splat: u.note.id }}
                  search={{ mode: "read", query: undefined, view: "grid" }}
                  className="link shrink-0 text-xs text-text-tertiary"
                >
                  {u.note.displayName}
                </Link>
              </li>
            ))}
          </ul>
        </DashboardSection>
      ) : null}

      {/* Active projects */}
      {activeProjects.length > 0 ? (
        <DashboardSection title="📁 Proyectos" count={activeProjects.length}>
          <ul className="flex flex-col gap-2">
            {activeProjects.map((project) => {
              const total = project.tasks.length
              const completed = project.tasks.filter((t) => t.completed).length
              const pct = total > 0 ? Math.round((completed / total) * 100) : 0
              const owner = project.frontmatter.owner as string | undefined
              return (
                <li key={project.id} className="flex items-center gap-3">
                  <Link
                    to="/notes/$"
                    params={{ _splat: project.id }}
                    search={{ mode: "read", query: undefined, view: "grid" }}
                    className="link flex-1 truncate text-sm font-medium"
                  >
                    {project.displayName}
                  </Link>
                  {total > 0 ? (
                    <div className="flex items-center gap-2">
                      <div className="h-1.5 w-16 rounded-full bg-bg-tertiary">
                        <div
                          className="h-full rounded-full bg-text-success"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <span className="text-xs text-text-tertiary">
                        {completed}/{total}
                      </span>
                    </div>
                  ) : null}
                  {owner ? (
                    <span className="text-xs text-text-tertiary">
                      {owner.replace(/\[\[|\]\]/g, "")}
                    </span>
                  ) : null}
                </li>
              )
            })}
          </ul>
        </DashboardSection>
      ) : null}

      {/* Recent notes */}
      {recent.length > 0 ? (
        <DashboardSection title="🕐 Recientes">
          <ul className="flex flex-col gap-1">
            {recent.map((note) => (
              <li key={note.id} className="flex items-center justify-between gap-2">
                <Link
                  to="/notes/$"
                  params={{ _splat: note.id }}
                  search={{ mode: "read", query: undefined, view: "grid" }}
                  className="link truncate text-sm"
                >
                  {note.displayName}
                </Link>
                {note.updatedAt ? (
                  <span className="shrink-0 text-xs text-text-tertiary">
                    {formatRelativeTime(note.updatedAt)}
                  </span>
                ) : null}
              </li>
            ))}
          </ul>
        </DashboardSection>
      ) : null}

      {/* Footer link to notes */}
      <div className="pb-4 text-center">
        <Link to="/" search={{ query: undefined, view: "grid" }} className="link text-sm">
          Ver todas las notas →
        </Link>
      </div>
    </div>
  )
}

function DashboardSection({
  title,
  count,
  children,
}: {
  title: string
  count?: number
  children: React.ReactNode
}) {
  return (
    <section className="card-1 flex flex-col gap-3 rounded-lg p-4">
      <h2 className="flex items-center gap-2 text-sm font-bold">
        {title}
        {count != null ? (
          <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-bg-tertiary px-1 text-xs font-medium text-text-secondary">
            {count}
          </span>
        ) : null}
      </h2>
      {children}
    </section>
  )
}

function friendlyTitle(item: Note): string {
  const body = item.content.replace(/^---[\s\S]*?---\n*/, "").trim()
  const firstLine = body
    .split("\n")[0]
    .replace(/^#+\s*/, "")
    .trim()
  return firstLine || item.displayName
}

function renderPreview(text: string): string {
  return text.replace(/\[\[([^\]|]+)\|([^\]]+)\]\]/g, "$2").replace(/\[\[([^\]]+)\]\]/g, "$1")
}

function formatRelativeTime(timestamp: number): string {
  const now = Date.now()
  const diff = now - timestamp
  const minutes = Math.floor(diff / 60000)
  if (minutes < 1) return "ahora"
  if (minutes < 60) return `hace ${minutes}m`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `hace ${hours}h`
  const days = Math.floor(hours / 24)
  if (days === 1) return "ayer"
  if (days < 7) return `hace ${days}d`
  return `hace ${Math.floor(days / 7)}sem`
}
```

- [ ] **Step 2: Verify build**

Run: `npm run build`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add src/components/dashboard-view.tsx
git commit -m "feat: dashboard view component with all 6 sections"
```

---

### Task 5: Conditional Home route

**Files:**

- Modify: `src/routes/_appRoot.index.tsx`

- [ ] **Step 1: Modify the Home route to conditionally render dashboard**

Replace the entire file content of `src/routes/_appRoot.index.tsx` with:

```tsx
import { createFileRoute, Link } from "@tanstack/react-router"
import { useAtomValue } from "jotai"
import { useState } from "react"
import { NoteIcon16 } from "../components/icons"
import { NoteList } from "../components/note-list"
import { PageLayout } from "../components/page-layout"
import { DashboardView } from "../components/dashboard-view"
import { shouldShowDashboardAtom } from "../global-state"

type RouteSearch = {
  query: string | undefined
  view: "grid" | "list"
}

export const Route = createFileRoute("/_appRoot/")({
  validateSearch: (search: Record<string, unknown>): RouteSearch => {
    return {
      query: typeof search.query === "string" ? search.query : undefined,
      view: search.view === "list" ? "list" : "grid",
    }
  },
  component: RouteComponent,
})

function RouteComponent() {
  const { query, view } = Route.useSearch()
  const navigate = Route.useNavigate()
  const shouldShowDashboard = useAtomValue(shouldShowDashboardAtom)
  const [forcedView, setForcedView] = useState<"dashboard" | "notes" | null>(null)

  const showDashboard = forcedView === "dashboard" || (forcedView === null && shouldShowDashboard)

  if (showDashboard) {
    return (
      <PageLayout title="Dashboard" icon={<NoteIcon16 />}>
        <DashboardView />
      </PageLayout>
    )
  }

  return (
    <PageLayout title="Notes" icon={<NoteIcon16 />}>
      <div className="p-4 pt-0">
        {shouldShowDashboard && forcedView === "notes" ? (
          <button
            onClick={() => setForcedView("dashboard")}
            className="mb-3 w-full rounded-lg bg-bg-secondary px-3 py-2 text-left text-sm text-text-secondary hover:bg-bg-secondary-hover"
          >
            Tienes pendientes — ver dashboard →
          </button>
        ) : null}
        <NoteList
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

- [ ] **Step 2: Add "Ver notas →" link handling in DashboardView**

The "Ver todas las notas →" link at the bottom of DashboardView currently links to `/` which would show the dashboard again. We need to pass a callback. Update the link in `dashboard-view.tsx` footer to use a prop:

Add a prop to `DashboardView`:

```tsx
type DashboardViewProps = {
  onShowNotes?: () => void
}

export function DashboardView({ onShowNotes }: DashboardViewProps) {
```

Replace the footer link at the bottom of DashboardView:

```tsx
{
  /* Footer link to notes */
}
;<div className="pb-4 text-center">
  <button onClick={onShowNotes} className="link text-sm">
    Ver todas las notas →
  </button>
</div>
```

Then in `_appRoot.index.tsx`, pass the callback:

```tsx
<DashboardView onShowNotes={() => setForcedView("notes")} />
```

- [ ] **Step 3: Verify build**

Run: `npm run build`
Expected: No errors

- [ ] **Step 4: Run format and lint**

```bash
npm run format
npm run lint
```

- [ ] **Step 5: Commit**

```bash
git add src/routes/_appRoot.index.tsx src/components/dashboard-view.tsx
git commit -m "feat: conditional Home route - dashboard when actionable items exist"
```

---

## Final verification

After all tasks complete:

```bash
npm run build
npm run format
npm run lint
```

## Parallelization Map

| Subagent | Tasks                          | Files touched                               |
| -------- | ------------------------------ | ------------------------------------------- |
| A        | Task 1 + 2 (utilities)         | `dashboard-templates.ts`, `dashboard-ai.ts` |
| B        | Task 3 (atoms)                 | `global-state.ts`                           |
| C        | Task 4 + 5 (component + route) | `dashboard-view.tsx`, `_appRoot.index.tsx`  |

**Dependencies:** C depends on A and B (component imports utilities and atoms). A and B are independent.
