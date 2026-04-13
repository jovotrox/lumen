import { useAtomValue, useSetAtom } from "jotai"
import React, { useDeferredValue, useMemo } from "react"
import { Link, useNavigate } from "@tanstack/react-router"
import { Calendar, CheckSquare, FolderKanban, Plus, Search, User } from "lucide-react"
import { globalStateMachineAtom, projectsAtom } from "../global-state"
import { generateNoteId } from "../utils/note-id"
import { SearchInput } from "./search-input"
import { DropdownMenu } from "./dropdown-menu"
import { EmptyState } from "./empty-state"
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

  return (
    <div className="flex flex-col gap-4">
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
          <DropdownMenu.Trigger
            render={
              <IconButton aria-label="View">
                {view === "grid" ? <GridIcon16 /> : <ListIcon16 />}
              </IconButton>
            }
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
      ) : (
        <ul className="flex flex-col gap-2">
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

        {/* Meta row: owner, deadline, top incomplete tasks */}
        <div className="flex flex-wrap items-center gap-3 text-xs text-text-secondary">
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
  const colors: Record<string, string> = {
    active: "text-text-success",
    paused: "text-text-pending",
    completed: "text-text-secondary",
    cancelled: "text-text-danger",
  }
  return <span className={colors[status] ?? "text-text-secondary"}>● {status}</span>
}

/** Convert YYYY-MM-DD to DD-MM-YYYY for display */
function formatDisplayDate(date: string): string {
  const parts = date.split("-")
  if (parts.length === 3) return `${parts[2]}-${parts[1]}-${parts[0]}`
  return date
}
