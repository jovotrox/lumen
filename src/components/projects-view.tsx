import { useAtomValue, useSetAtom } from "jotai"
import React, { useDeferredValue, useMemo } from "react"
import { Link, useNavigate } from "@tanstack/react-router"
import { globalStateMachineAtom, projectsAtom } from "../global-state"
import { generateNoteId } from "../utils/note-id"
import { Plus } from "lucide-react"
import { SearchInput } from "./search-input"
import { DropdownMenu } from "./dropdown-menu"
import { IconButton } from "./icon-button"
import { GridIcon16, ListIcon16 } from "./icons"
import { Button } from "./button"
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
        <Button size="small" onClick={createProject}>
          <Plus size={14} />
          New
        </Button>
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
