import { useAtomValue, useSetAtom } from "jotai"
import React, { useEffect, useMemo, useState } from "react"
import { Link } from "@tanstack/react-router"
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
import type { Note, Task } from "../schema"

type DashboardViewProps = {
  onShowNotes?: () => void
}

export function DashboardView({ onShowNotes }: DashboardViewProps) {
  const inboxItems = useAtomValue(inboxAtom)
  const { tasks: todayTasks, noteId: todayNoteId } = useAtomValue(todayTasksAtom)
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
                  onCheckedChange={(checked) => toggleTodayTask(task, checked === true)}
                  className="mt-0.5"
                />
                <span className="text-sm">{renderPreview(task.text)}</span>
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
        <button onClick={onShowNotes} className="link text-sm">
          Ver todas las notas →
        </button>
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
