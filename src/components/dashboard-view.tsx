import { useAtomValue, useSetAtom } from "jotai"
import React, { useEffect, useMemo, useState } from "react"
import { Link, useNavigate } from "@tanstack/react-router"
import {
  AlertTriangle,
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
import { generateAISummary } from "../utils/dashboard-ai"
import { getGreeting } from "../utils/dashboard-templates"
import { generateNoteId } from "../utils/note-id"
import { dismissNudge } from "../utils/nudges"
import { updateTaskCompletion } from "../utils/task"
import { Checkbox } from "./checkbox"
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
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-6 p-4">
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

      {/* Greeting */}
      <section className="flex flex-col gap-3">
        <h1 className="font-bold tracking-tight" style={{ fontSize: "2rem", lineHeight: 1.1 }}>
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

      {/* Active projects */}
      {activeProjects.length > 0 ? (
        <DashboardSection
          icon={<FolderOpen size={16} />}
          title="Projects"
          count={activeProjects.length}
        >
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
      <DashboardSection icon={<Clock size={16} />} title="Recent">
        {recent.length > 0 ? (
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
        ) : (
          <p className="text-sm text-text-tertiary">No recent notes yet.</p>
        )}
      </DashboardSection>

      {/* Link to all notes */}
      <div className="pb-4 text-center">
        <Link to="/notes" search={{ query: undefined, view: "grid" }} className="link text-sm">
          View all notes →
        </Link>
      </div>
    </div>
  )
}

// --- Helpers ---

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
    <section className="card-1 flex flex-col gap-3 rounded-lg p-4">
      <h2 className={`flex items-center gap-2 text-sm font-bold ${titleClassName ?? ""}`}>
        {icon}
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

function formatRelativeTime(timestamp: number): string {
  const now = Date.now()
  const diff = now - timestamp
  const minutes = Math.floor(diff / 60000)
  if (minutes < 1) return "now"
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days === 1) return "yesterday"
  if (days < 7) return `${days}d ago`
  return `${Math.floor(days / 7)}w ago`
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
