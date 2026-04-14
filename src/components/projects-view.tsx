import { useAtomValue, useSetAtom } from "jotai"
import React, { useDeferredValue, useMemo } from "react"
import { Link, useNavigate } from "@tanstack/react-router"
import {
  AlertTriangle,
  Calendar,
  CheckSquare,
  FolderKanban,
  Grid2x2,
  Grid3x3,
  LayoutGrid,
  List,
  Plus,
  Search,
  User,
} from "lucide-react"
import { cx } from "../utils/cx"
import { globalStateMachineAtom, projectsAtom } from "../global-state"
import { generateNoteId } from "../utils/note-id"
import { SearchInput } from "./search-input"
import { DropdownMenu } from "./dropdown-menu"
import { EmptyState } from "./empty-state"
import { IconButton } from "./icon-button"
import { NotePreview } from "./note-preview"
import type { Note } from "../schema"
import type { ViewMode } from "../routes/_appRoot.projects"

const gridCols: Record<Exclude<ViewMode, "list">, string> = {
  sm: "grid-cols-[repeat(auto-fill,minmax(200px,1fr))]",
  md: "grid-cols-[repeat(auto-fill,minmax(280px,1fr))]",
  lg: "grid-cols-[repeat(auto-fill,minmax(360px,1fr))]",
}

type ProjectsViewProps = {
  query: string
  view: ViewMode
  onQueryChange: (query: string) => void
  onViewChange: (view: ViewMode) => void
}

export function ProjectsView({ query, view, onQueryChange, onViewChange }: ProjectsViewProps) {
  const projects = useAtomValue(projectsAtom)
  const send = useSetAtom(globalStateMachineAtom)
  const navigate = useNavigate()
  const deferredQuery = useDeferredValue(query)

  const createProject = () => {
    const id = generateNoteId()
    const content = `---\ntype: project\nstatus: active\n---\n\n# New Project\n`
    send({
      type: "WRITE_FILES",
      markdownFiles: { [`${id}.md`]: content },
    })
    navigate({
      to: "/notes/$",
      params: { _splat: id },
      search: { mode: "write", query: undefined, view: "grid" },
    })
  }

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

  const viewIcon =
    view === "list" ? (
      <List size={16} />
    ) : view === "sm" ? (
      <Grid3x3 size={16} />
    ) : view === "md" ? (
      <LayoutGrid size={16} />
    ) : (
      <Grid2x2 size={16} />
    )

  return (
    <div className="flex flex-1 flex-col gap-4">
      <div className="flex items-center gap-2">
        <SearchInput
          placeholder={`Search ${filteredProjects.length} projects…`}
          value={query}
          onChange={onQueryChange}
        />
        <IconButton
          aria-label="New project"
          className="h-10 w-10 shrink-0 rounded-lg bg-bg-secondary text-text hover:bg-bg-secondary-hover! active:bg-bg-secondary-active! epaper:ring-1 epaper:ring-inset epaper:ring-border epaper:focus-visible:ring-2 coarse:h-12 coarse:w-12"
          onClick={createProject}
        >
          <Plus size={16} />
        </IconButton>
        <DropdownMenu>
          <DropdownMenu.Trigger render={<IconButton aria-label="View">{viewIcon}</IconButton>} />
          <DropdownMenu.Content align="end" width={140}>
            <DropdownMenu.Group>
              <DropdownMenu.GroupLabel>Grid</DropdownMenu.GroupLabel>
              <DropdownMenu.Item
                icon={<Grid3x3 size={16} />}
                selected={view === "sm"}
                onClick={() => onViewChange("sm")}
              >
                Small
              </DropdownMenu.Item>
              <DropdownMenu.Item
                icon={<LayoutGrid size={16} />}
                selected={view === "md"}
                onClick={() => onViewChange("md")}
              >
                Medium
              </DropdownMenu.Item>
              <DropdownMenu.Item
                icon={<Grid2x2 size={16} />}
                selected={view === "lg"}
                onClick={() => onViewChange("lg")}
              >
                Large
              </DropdownMenu.Item>
            </DropdownMenu.Group>
            <DropdownMenu.Separator />
            <DropdownMenu.Item
              icon={<List size={16} />}
              selected={view === "list"}
              onClick={() => onViewChange("list")}
            >
              List
            </DropdownMenu.Item>
          </DropdownMenu.Content>
        </DropdownMenu>
      </div>
      {filteredProjects.length === 0 ? (
        projects.length === 0 ? (
          <EmptyState
            icon={<FolderKanban size={28} />}
            title="No projects yet"
            description="Add `type: project` to a note's frontmatter to start tracking."
          />
        ) : (
          <EmptyState
            icon={<Search size={28} />}
            title="No matches"
            description="Try different search terms or clear the filter."
          />
        )
      ) : view === "list" ? (
        <ul className="flex flex-col gap-2">
          {filteredProjects.map((project) => (
            <ProjectListItem key={project.id} project={project} />
          ))}
        </ul>
      ) : (
        <div className={cx("grid gap-4", gridCols[view])}>
          {filteredProjects.map((project) => (
            <ProjectGridCard key={project.id} project={project} />
          ))}
        </div>
      )}
    </div>
  )
}

function ProjectGridCard({ project }: { project: Note }) {
  const status = (project.frontmatter.status as string) ?? "active"
  const rawDeadline = project.frontmatter.deadline
  const deadline =
    rawDeadline instanceof Date
      ? rawDeadline.toISOString().slice(0, 10)
      : typeof rawDeadline === "string"
        ? rawDeadline
        : undefined
  const total = project.tasks.length
  const completed = project.tasks.filter((t) => t.completed).length
  const pct = total > 0 ? Math.round((completed / total) * 100) : 0
  const isOverdue =
    deadline && new Date(deadline + "T23:59:59").getTime() < Date.now() && status === "active"

  return (
    <Link
      to="/notes/$"
      params={{ _splat: project.id }}
      search={{ mode: "read", query: undefined, view: "grid" }}
      draggable={false}
      className="card-1 group flex flex-col overflow-hidden rounded-lg transition-[outline] hover:outline hover:outline-2 hover:outline-[var(--neutral-7)]"
    >
      {/* Content preview */}
      <div className="grow overflow-hidden [mask-image:linear-gradient(to_bottom,black_0%,black_60%,transparent_100%)]">
        <NotePreview note={project} hideProperties />
      </div>
      {/* Footer */}
      <div className="flex flex-col gap-2 px-3 pb-3">
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

function ProjectListItem({ project }: { project: Note }) {
  const status = (project.frontmatter.status as string) ?? "active"
  const owner = project.frontmatter.owner as string | undefined
  const priority = project.frontmatter.priority as number | undefined
  const rawDeadline = project.frontmatter.deadline
  const deadline =
    rawDeadline instanceof Date
      ? rawDeadline.toISOString().slice(0, 10)
      : typeof rawDeadline === "string"
        ? rawDeadline
        : undefined
  const totalTasks = project.tasks.length
  const completedTasks = project.tasks.filter((t) => t.completed).length
  const incompleteTasks = project.tasks.filter((t) => !t.completed)
  const pct = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0

  // Content preview (strip frontmatter, take first meaningful line)
  const preview = project.content
    .replace(/^---[\s\S]*?---\n*/, "")
    .trim()
    .split("\n")
    .filter((l) => !l.startsWith("#") && !l.startsWith("- [") && l.trim())
    .slice(0, 2)
    .join(" ")
    .replace(/\[\[([^\]|]+)\|([^\]]+)\]\]/g, "$2")
    .replace(/\[\[([^\]]+)\]\]/g, "$1")
    .slice(0, 120)

  // Deadline status
  const isOverdue =
    deadline && new Date(deadline + "T23:59:59").getTime() < Date.now() && status === "active"

  return (
    <li>
      <Link
        to="/notes/$"
        params={{ _splat: project.id }}
        search={{ mode: "read", query: undefined, view: "grid" }}
        draggable={false}
        className="card-1 flex flex-col gap-2.5 rounded-lg px-4 py-3 transition-colors hover:bg-bg-secondary active:bg-bg-tertiary"
      >
        {/* Header: name + status */}
        <div className="flex items-center justify-between gap-3">
          <span className="truncate font-medium">{project.displayName}</span>
          <StatusBadge status={status} />
        </div>

        {/* Preview */}
        {preview ? (
          <p className="line-clamp-2 text-xs leading-relaxed text-text-tertiary">{preview}</p>
        ) : null}

        {/* Progress bar */}
        {totalTasks > 0 ? (
          <div className="flex items-center gap-2">
            <div className="h-1.5 flex-1 rounded-full bg-bg-tertiary">
              <div
                className="h-full rounded-full bg-text-success transition-all"
                style={{ width: `${pct}%` }}
              />
            </div>
            <span className="shrink-0 text-xs text-text-secondary">
              {completedTasks}/{totalTasks}
            </span>
          </div>
        ) : null}

        {/* Meta row: priority, owner, deadline, top incomplete tasks */}
        <div className="flex flex-wrap items-center gap-3 text-xs text-text-secondary">
          {priority ? (
            <span className={cx("flex items-center gap-1", priorityColor(priority))}>
              <AlertTriangle size={12} />
              {priority === 1 ? "High" : priority === 2 ? "Medium" : "Low"}
            </span>
          ) : null}
          {owner ? (
            <span className="flex items-center gap-1">
              <User size={12} />
              {owner.replace(/\[\[|\]\]/g, "")}
            </span>
          ) : null}
          {deadline ? (
            <span className={`flex items-center gap-1 ${isOverdue ? "text-text-danger" : ""}`}>
              <Calendar size={12} />
              {formatDisplayDate(deadline)}
              {isOverdue ? " (overdue)" : ""}
            </span>
          ) : null}
          {incompleteTasks.length > 0 ? (
            <span className="flex items-center gap-1">
              <CheckSquare size={12} />
              {incompleteTasks.length} pending
            </span>
          ) : null}
        </div>
      </Link>
    </li>
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
        "inline-flex w-fit items-center gap-1 rounded-full px-1.5 py-px text-[11px] font-medium capitalize",
        styles[status] ?? "bg-bg-tertiary text-text-secondary",
      )}
    >
      <span className="text-[7px]">●</span>
      {status}
    </span>
  )
}

function priorityColor(priority: number): string {
  if (priority === 1) return "text-text-danger"
  if (priority === 2) return "text-text-pending"
  return "text-text-secondary"
}

/** Format YYYY-MM-DD as "Apr 14" */
function formatShortDate(date: string): string {
  const d = new Date(date + "T00:00:00")
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" })
}

/** Convert YYYY-MM-DD to DD-MM-YYYY for display */
function formatDisplayDate(date: string): string {
  const parts = date.split("-")
  if (parts.length === 3) return `${parts[2]}-${parts[1]}-${parts[0]}`
  return date
}
