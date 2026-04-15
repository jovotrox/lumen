import { useAtomValue, useSetAtom } from "jotai"
import React, { useEffect, useMemo, useState } from "react"
import { Link, useNavigate } from "@tanstack/react-router"
import {
  AlertTriangle,
  Calendar,
  CalendarPlus,
  CheckSquare,
  Clock,
  Cloud,
  CloudDrizzle,
  CloudLightning,
  CloudSnow,
  CloudSun,
  FilePlus,
  FolderOpen,
  Inbox,
  ListPlus,
  Sparkles,
  Sun,
  Wind,
  X,
} from "lucide-react"
import {
  aiProviderAtom,
  claudeApiKeyAtom,
  globalStateMachineAtom,
  inboxAtom,
  nicknameAtom,
  notesAtom,
  ollamaModelAtom,
  ollamaUrlAtom,
  openaiKeyAtom,
  nudgeDismissVersionAtom,
  nudgesAtom,
  projectsAtom,
  sortedNotesAtom,
  tempUnitAtom,
  todayTasksAtom,
  urgentTasksAtom,
} from "../global-state"
import { cx } from "../utils/cx"
import { generateAISummary } from "../utils/dashboard-ai"
import { getGreeting } from "../utils/dashboard-templates"
import { generateNoteId } from "../utils/note-id"
import { dismissNudge } from "../utils/nudges"
import { updateTaskCompletion } from "../utils/task"
import { Checkbox } from "./checkbox"
import { NotePreview } from "./note-preview"
import type { Note, Task } from "../schema"

export function DashboardView() {
  const inboxItems = useAtomValue(inboxAtom)
  const { tasks: todayTasks, noteId: todayNoteId } = useAtomValue(todayTasksAtom)
  const urgentTasks = useAtomValue(urgentTasksAtom)
  const projects = useAtomValue(projectsAtom)
  const recentNotes = useAtomValue(sortedNotesAtom)
  const notes = useAtomValue(notesAtom)
  const send = useSetAtom(globalStateMachineAtom)
  const navigate = useNavigate()
  const tempUnit = useAtomValue(tempUnitAtom)
  const nudges = useAtomValue(nudgesAtom)
  const setDismissVersion = useSetAtom(nudgeDismissVersionAtom)

  const handleDismissNudge = (id: string) => {
    dismissNudge(id)
    setDismissVersion((v) => v + 1)
  }
  const nickname = useAtomValue(nicknameAtom)

  const aiProvider = useAtomValue(aiProviderAtom)
  const openaiKey = useAtomValue(openaiKeyAtom)
  const claudeKey = useAtomValue(claudeApiKeyAtom)
  const ollamaUrl = useAtomValue(ollamaUrlAtom)
  const ollamaModel = useAtomValue(ollamaModelAtom)
  const apiKey = aiProvider === "openai" ? openaiKey : claudeKey
  const hasKey = aiProvider === "ollama" || apiKey !== ""

  const unprocessed = useMemo(
    () => inboxItems.filter((item) => item.frontmatter.status === "unprocessed"),
    [inboxItems],
  )

  const activeProjects = useMemo(
    () => projects.filter((p) => p.frontmatter.status === "active"),
    [projects],
  )

  const incompleteTodayTasks = useMemo(() => todayTasks.filter((t) => !t.completed), [todayTasks])

  // AI summary
  const [aiSummary, setAiSummary] = useState<string | null>(null)

  useEffect(() => {
    if (!hasKey) return
    const projectNames = activeProjects.map((p) => p.displayName)
    const urgentTexts = urgentTasks.map((u) => u.task.text)
    const data = {
      inbox: unprocessed.length,
      tasks: incompleteTodayTasks.length,
      todayCompleted: todayTasks.filter((t) => t.completed).length,
      urgentTasks: urgentTasks.length,
      projects: activeProjects.length,
      topProject: null,
      topProjectProgress: null,
      nickname,
    }
    generateAISummary(
      data,
      aiProvider as "openai" | "claude" | "ollama",
      apiKey,
      projectNames,
      urgentTexts,
      ollamaUrl,
      ollamaModel,
    )
      .then(setAiSummary)
      .catch(() => {})
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Weather
  const [weather, setWeather] = useState<{
    temp: number
    description: string
    icon: React.ReactNode
  } | null>(null)

  useEffect(() => {
    fetchWeather(tempUnit)
      .then(setWeather)
      .catch(() => {})
  }, [tempUnit])

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

  const hasDailyNote = notes.has(todayNoteId)
  const hasPendingItems =
    unprocessed.length > 0 || incompleteTodayTasks.length > 0 || urgentTasks.length > 0

  // Date
  const now = new Date()
  const dayName = now.toLocaleDateString("en-US", { weekday: "long" })
  const fullDate = now.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  })

  // Build summary parts as linked fragments
  const summaryParts: React.ReactNode[] = []
  if (incompleteTodayTasks.length > 0) {
    summaryParts.push(
      <Link
        key="tasks"
        to="/notes/$"
        params={{ _splat: todayNoteId }}
        search={{ mode: "read", query: undefined, view: "grid" }}
        className="text-text hover:underline"
      >
        <CheckSquare size={16} className="mb-0.5 mr-1 inline" />
        <strong>
          {incompleteTodayTasks.length} task{incompleteTodayTasks.length > 1 ? "s" : ""} today
        </strong>
      </Link>,
    )
  }
  if (unprocessed.length > 0) {
    summaryParts.push(
      <Link
        key="inbox"
        to="/inbox"
        search={{ query: undefined }}
        className="text-text hover:underline"
      >
        <Inbox size={16} className="mb-0.5 mr-1 inline" />
        <strong>{unprocessed.length} in inbox</strong>
      </Link>,
    )
  }
  if (activeProjects.length > 0) {
    summaryParts.push(
      <Link
        key="projects"
        to="/projects"
        search={{ query: undefined, view: "list" }}
        className="text-text hover:underline"
      >
        <FolderOpen size={16} className="mb-0.5 mr-1 inline" />
        <strong>
          {activeProjects.length} active project{activeProjects.length > 1 ? "s" : ""}
        </strong>
      </Link>,
    )
  }
  if (urgentTasks.length > 0) {
    summaryParts.push(
      <Link
        key="urgent"
        to="/tasks"
        search={{ query: undefined, view: "grid" }}
        className="text-text-danger hover:underline"
      >
        <AlertTriangle size={16} className="mb-0.5 mr-1 inline" />
        <strong>{urgentTasks.length} urgent</strong>
      </Link>,
    )
  }

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-10 overflow-x-hidden p-4 pt-8">
      {/* Hero: date + greeting + actions */}
      <section className="flex flex-col gap-3">
        {/* Date + weather */}
        <div className="flex items-center justify-between text-sm text-text-secondary">
          <span>
            {dayName}, {fullDate}
          </span>
          {weather ? (
            <span className="flex items-center gap-1.5">
              {weather.icon}
              {weather.temp}°{tempUnit} · {weather.description}
            </span>
          ) : null}
        </div>
        <h1
          className="select-none font-bold tracking-tight"
          style={{ fontSize: "2rem", lineHeight: 1.1 }}
        >
          {getGreeting()}
          {nickname ? `, ${nickname}` : ""}.
        </h1>
        {aiSummary ? (
          <p className="text-text-secondary" style={{ fontSize: "1.5rem", lineHeight: 1.3 }}>
            {aiSummary}
            {nudges.length > 0 ? (
              <span className="text-text-secondary">
                {" "}
                <AlertTriangle size={16} className="mb-0.5 mr-1 inline text-text-pending" />
                <strong className="text-text-pending">
                  {nudges.length} item{nudges.length > 1 ? "s" : ""}
                </strong>{" "}
                need your attention.
              </span>
            ) : null}
          </p>
        ) : summaryParts.length > 0 ? (
          <p className="text-text-secondary" style={{ fontSize: "1.5rem", lineHeight: 1.3 }}>
            You have {joinNodes(summaryParts)}.
            {nudges.length > 0 ? (
              <span className="text-text-secondary">
                {" "}
                <AlertTriangle size={16} className="mb-0.5 mr-1 inline text-text-pending" />
                <strong className="text-text-pending">
                  {nudges.length} item{nudges.length > 1 ? "s" : ""}
                </strong>{" "}
                need your attention.
              </span>
            ) : null}
          </p>
        ) : (
          <p className="text-text-secondary" style={{ fontSize: "1.5rem", lineHeight: 1.3 }}>
            Nothing pending. Enjoy your day.
          </p>
        )}

        {/* Quick actions */}
        <div className="flex gap-2 pt-1">
          <button
            onClick={() => {
              const today = todayNoteId
              const existing = notes.get(today)
              if (existing) {
                navigate({
                  to: "/notes/$",
                  params: { _splat: today },
                  search: { mode: "write", query: undefined, view: "grid" },
                })
              } else {
                send({
                  type: "WRITE_FILES",
                  markdownFiles: { [`${today}.md`]: "" },
                })
                navigate({
                  to: "/notes/$",
                  params: { _splat: today },
                  search: { mode: "write", query: undefined, view: "grid" },
                })
              }
            }}
            className="flex cursor-pointer items-center gap-1.5 rounded-lg bg-bg-secondary px-3 py-1.5 text-sm text-text-secondary hover:bg-bg-secondary-hover"
          >
            <CalendarPlus size={14} />
            Daily note
          </button>
          <button
            onClick={() => {
              const today = todayNoteId
              const existing = notes.get(today)
              const taskLine = `- [ ] `
              if (existing) {
                const content = existing.content.trimEnd() + "\n" + taskLine
                send({ type: "WRITE_FILES", markdownFiles: { [`${today}.md`]: content } })
              } else {
                send({
                  type: "WRITE_FILES",
                  markdownFiles: { [`${today}.md`]: `${taskLine}` },
                })
              }
              navigate({
                to: "/notes/$",
                params: { _splat: today },
                search: { mode: "write", query: undefined, view: "grid" },
              })
            }}
            className="flex cursor-pointer items-center gap-1.5 rounded-lg bg-bg-secondary px-3 py-1.5 text-sm text-text-secondary hover:bg-bg-secondary-hover"
          >
            <ListPlus size={14} />
            New task
          </button>
          <button
            onClick={() => {
              const noteId = generateNoteId()
              navigate({
                to: "/notes/$",
                params: { _splat: noteId },
                search: { mode: "write", query: undefined, view: "grid" },
              })
            }}
            className="flex cursor-pointer items-center gap-1.5 rounded-lg bg-bg-secondary px-3 py-1.5 text-sm text-text-secondary hover:bg-bg-secondary-hover"
          >
            <FilePlus size={14} />
            New note
          </button>
        </div>
      </section>

      {/* Divider */}
      <div className="h-px bg-border-secondary" />

      {/* Nudges */}
      {nudges.length > 0 ? (
        <DashboardSection
          icon={<AlertTriangle size={16} />}
          title="Needs attention"
          count={nudges.length}
          titleClassName="text-text-pending"
        >
          <ul className="flex flex-col gap-1.5">
            {nudges.slice(0, 8).map((nudge, i) => (
              <li key={i} className="flex items-start gap-2 text-sm">
                <NudgeIcon type={nudge.type} />
                <span className="flex-1 text-text-secondary">{nudge.message}</span>
                {nudge.noteId ? (
                  <Link
                    to="/notes/$"
                    params={{ _splat: nudge.noteId }}
                    search={{ mode: "read", query: undefined, view: "grid" }}
                    className="link shrink-0 text-xs"
                  >
                    View
                  </Link>
                ) : nudge.type === "inbox_pileup" ? (
                  <Link to="/inbox" search={{ query: undefined }} className="link shrink-0 text-xs">
                    Process
                  </Link>
                ) : null}
                <button
                  onClick={() => handleDismissNudge(nudge.id)}
                  className="shrink-0 cursor-pointer rounded p-0.5 text-text-tertiary hover:bg-bg-secondary hover:text-text-secondary"
                  aria-label="Dismiss"
                >
                  <X size={12} />
                </button>
              </li>
            ))}
          </ul>
        </DashboardSection>
      ) : null}

      {/* Inbox */}
      {unprocessed.length > 0 ? (
        <DashboardSection icon={<Inbox size={16} />} title="Inbox" count={unprocessed.length}>
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
            Process inbox →
          </Link>
        </DashboardSection>
      ) : null}

      {/* Today's tasks */}
      {incompleteTodayTasks.length > 0 ? (
        <DashboardSection
          icon={<CheckSquare size={16} />}
          title="Today"
          count={incompleteTodayTasks.length}
        >
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
            Open today's note →
          </Link>
        </DashboardSection>
      ) : null}

      {/* Urgent tasks */}
      {urgentTasks.length > 0 ? (
        <DashboardSection
          icon={<AlertTriangle size={16} />}
          title="Urgent"
          count={urgentTasks.length}
          titleClassName="text-text-danger"
        >
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

      {/* Empty state */}
      {!hasPendingItems ? (
        <section className="flex flex-col items-center gap-3 rounded-lg border border-border-secondary py-8 text-center">
          <Sparkles size={32} className="text-text-tertiary" />
          <p className="text-text-secondary">No pending tasks — you're all clear!</p>
          {!hasDailyNote ? (
            <Link
              to="/notes/$"
              params={{ _splat: todayNoteId }}
              search={{ mode: "write", query: undefined, view: "grid" }}
              className="link text-sm font-medium"
            >
              Start today's note →
            </Link>
          ) : (
            <Link
              to="/notes/$"
              params={{ _splat: todayNoteId }}
              search={{ mode: "read", query: undefined, view: "grid" }}
              className="link text-sm font-medium"
            >
              Open today's note →
            </Link>
          )}
        </section>
      ) : null}

      {/* Active projects — carousel */}
      {activeProjects.length > 0 ? (
        <section className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <h2 className="flex select-none items-center gap-2 text-sm font-bold">
              <FolderOpen size={16} />
              Projects
              <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-bg-tertiary px-1 text-xs font-medium text-text-secondary">
                {activeProjects.length}
              </span>
            </h2>
            <Link
              to="/projects"
              search={{ query: undefined, view: "list" }}
              className="link text-sm"
            >
              View all →
            </Link>
          </div>
          <RecentCarousel>
            {activeProjects.map((project) => (
              <ProjectCard key={project.id} project={project} />
            ))}
          </RecentCarousel>
        </section>
      ) : null}

      {/* Recently visited — horizontal carousel */}
      {recent.length > 0 ? (
        <section className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <h2 className="flex select-none items-center gap-2 text-sm font-bold">
              <Clock size={16} />
              Recently visited
            </h2>
            <Link to="/notes" search={{ query: undefined, view: "grid" }} className="link text-sm">
              View all →
            </Link>
          </div>
          <RecentCarousel>
            {recent.map((note) => (
              <Link
                key={note.id}
                to="/notes/$"
                params={{ _splat: note.id }}
                search={{ mode: "read", query: undefined, view: "grid" }}
                className="card-1 block w-[200px] shrink-0 snap-start overflow-hidden rounded-lg"
              >
                <NotePreview note={note} hideProperties />
              </Link>
            ))}
          </RecentCarousel>
        </section>
      ) : null}

      <div className="pb-4" />
    </div>
  )
}

// --- Helpers ---

function RecentCarousel({ children }: { children: React.ReactNode }) {
  const scrollRef = React.useRef<HTMLDivElement>(null)
  const [canScrollLeft, setCanScrollLeft] = useState(false)
  const [canScrollRight, setCanScrollRight] = useState(false)

  const updateScrollState = React.useCallback(() => {
    const el = scrollRef.current
    if (!el) return
    setCanScrollLeft(el.scrollLeft > 1)
    setCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 1)
  }, [])

  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    // Reset scroll to 0 on mount to avoid snap-induced offset
    el.scrollLeft = 0
    updateScrollState()
    el.addEventListener("scroll", updateScrollState, { passive: true })
    return () => el.removeEventListener("scroll", updateScrollState)
  }, [updateScrollState])

  return (
    <div className="relative min-w-0 overflow-hidden">
      {canScrollLeft ? (
        <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-6 bg-gradient-to-r from-[var(--color-bg)] to-transparent" />
      ) : null}
      {canScrollRight ? (
        <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-6 bg-gradient-to-l from-[var(--color-bg)] to-transparent" />
      ) : null}
      <div
        ref={scrollRef}
        className="flex gap-3 overflow-x-auto [-webkit-overflow-scrolling:touch] py-1 scrollbar-hide snap-x"
      >
        {children}
      </div>
    </div>
  )
}

function ProjectCard({ project }: { project: Note }) {
  const total = project.tasks.length
  const completed = project.tasks.filter((t) => t.completed).length
  const pct = total > 0 ? Math.round((completed / total) * 100) : 0
  const status = (project.frontmatter.status as string) ?? "active"
  const rawDeadline = project.frontmatter.deadline
  const deadline =
    rawDeadline instanceof Date
      ? rawDeadline.toISOString().slice(0, 10)
      : typeof rawDeadline === "string"
        ? rawDeadline
        : undefined
  const isOverdue =
    deadline && new Date(deadline + "T23:59:59").getTime() < Date.now() && status === "active"
  const hasContent = project.content.replace(/^---[\s\S]*?---\n*/, "").trim().length > 0

  return (
    <Link
      to="/notes/$"
      params={{ _splat: project.id }}
      search={{ mode: "read", query: undefined, view: "grid" }}
      className="card-1 flex w-[280px] shrink-0 snap-start flex-col overflow-hidden rounded-lg"
    >
      {/* Content preview or spacer */}
      {hasContent ? (
        <div className="grow overflow-hidden [mask-image:linear-gradient(to_bottom,black_0%,black_60%,transparent_100%)]">
          <NotePreview note={project} hideProperties />
        </div>
      ) : (
        <div className="p-4 pb-0" />
      )}
      {/* Footer */}
      <div className="flex flex-col gap-2 px-3 pb-3">
        {/* Progress */}
        {total > 0 ? (
          <div className="flex items-center gap-2">
            <div className="h-1 flex-1 rounded-full bg-bg-tertiary">
              <div
                className="h-full rounded-full bg-text-success transition-all"
                style={{ width: `${pct}%` }}
              />
            </div>
            <span className="shrink-0 text-[11px] text-text-tertiary">
              {completed}/{total}
            </span>
          </div>
        ) : null}
        {/* Status + Deadline */}
        <div className="flex items-center gap-2">
          <StatusBadge status={status} />
          {deadline ? (
            <span
              className={cx(
                "flex items-center gap-1 text-[11px] text-text-tertiary",
                isOverdue && "text-text-danger",
              )}
            >
              <Calendar size={11} />
              {formatShortDate(deadline)}
              {isOverdue ? " (overdue)" : ""}
            </span>
          ) : null}
        </div>
      </div>
    </Link>
  )
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    active: "bg-text-success/15 text-text-success",
    paused: "bg-text-pending/15 text-text-pending",
    completed: "bg-bg-tertiary text-text-secondary",
    cancelled: "bg-text-danger/15 text-text-danger",
  }
  return (
    <span
      className={cx(
        "inline-flex shrink-0 items-center gap-1 rounded-full px-1.5 py-px text-[11px] font-medium capitalize",
        styles[status] ?? "bg-bg-tertiary text-text-secondary",
      )}
    >
      <span className="text-[7px]">●</span>
      {status}
    </span>
  )
}

/** Format YYYY-MM-DD as "Apr 14" */
function formatShortDate(date: string): string {
  const d = new Date(date + "T00:00:00")
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" })
}

function DashboardSection({
  icon,
  title,
  count,
  titleClassName,
  children,
}: {
  icon: React.ReactNode
  title: string
  count?: number
  titleClassName?: string
  children: React.ReactNode
}) {
  return (
    <section className="flex flex-col gap-3">
      <h2
        className={`flex select-none items-center gap-2 text-sm font-bold ${titleClassName ?? ""}`}
      >
        {icon}
        {title}
        {count != null ? (
          <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-bg-tertiary px-1 text-xs font-medium text-text-secondary">
            {count}
          </span>
        ) : null}
      </h2>
      <div className="card-1 flex flex-col gap-3 rounded-lg p-4">{children}</div>
    </section>
  )
}

/** Join React nodes with commas and "and" */
function joinNodes(nodes: React.ReactNode[]): React.ReactNode {
  if (nodes.length === 0) return null
  if (nodes.length === 1) return nodes[0]
  return nodes.reduce((acc, node, i) => (
    <>
      {acc}
      {i === nodes.length - 1 ? " and " : ", "}
      {node}
    </>
  ))
}

function NudgeIcon({ type }: { type: string }) {
  const cls = "mt-0.5 shrink-0 text-text-pending"
  switch (type) {
    case "overdue_followup":
      return <AlertTriangle size={14} className={cls} />
    case "stale_task":
      return <Clock size={14} className={cls} />
    case "inactive_project":
      return <FolderOpen size={14} className={cls} />
    case "inbox_pileup":
      return <Inbox size={14} className={cls} />
    default:
      return <AlertTriangle size={14} className={cls} />
  }
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
  return (
    text
      // [[id|Name]] → Name
      .replace(/\[\[([^\]|]+)\|([^\]]+)\]\]/g, "$2")
      // [[numeric-id]] → remove entirely (bare note ID links)
      .replace(/\[\[\d+\]\]/g, "")
      // [[readable-id]] → readable-id
      .replace(/\[\[([^\]]+)\]\]/g, "$1")
      // Trailing date (2026-04-10) — strip from end of task text
      .replace(/\s+\d{4}-\d{2}-\d{2}\s*$/, "")
      .trim()
  )
}

// --- Weather ---

const weatherIconMap: Record<string, React.ReactNode> = {
  Clear: <Sun size={14} />,
  Sunny: <Sun size={14} />,
  "Partly cloudy": <CloudSun size={14} />,
  "Partly Cloudy": <CloudSun size={14} />,
  Cloudy: <Cloud size={14} />,
  Overcast: <Cloud size={14} />,
  Mist: <Wind size={14} />,
  Fog: <Wind size={14} />,
  Rain: <CloudDrizzle size={14} />,
  "Light rain": <CloudDrizzle size={14} />,
  "Light drizzle": <CloudDrizzle size={14} />,
  "Heavy rain": <CloudDrizzle size={14} />,
  Snow: <CloudSnow size={14} />,
  Thunderstorm: <CloudLightning size={14} />,
}

async function fetchWeather(
  unit: "C" | "F",
): Promise<{ temp: number; description: string; icon: React.ReactNode }> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 5000)
  const response = await fetch("https://wttr.in/?format=j1", {
    headers: { Accept: "application/json" },
    signal: controller.signal,
  })
  clearTimeout(timeout)
  if (!response.ok) throw new Error("Weather fetch failed")
  const data = (await response.json()) as {
    current_condition: { temp_C: string; temp_F: string; weatherDesc: { value: string }[] }[]
  }
  const current = data.current_condition[0]
  const temp = parseInt(unit === "C" ? current.temp_C : current.temp_F, 10)
  const description = current.weatherDesc[0]?.value ?? "Unknown"
  const icon = weatherIconMap[description] ?? <CloudSun size={14} />
  return { temp, description, icon }
}
