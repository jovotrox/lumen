import { useAtomValue, useSetAtom } from "jotai"
import React, { useDeferredValue, useMemo } from "react"
import { Link, useNavigate } from "@tanstack/react-router"
import { Grid2x2, Grid3x3, LayoutGrid, List, Plus, Search, Users } from "lucide-react"
import { cx } from "../utils/cx"
import { globalStateMachineAtom, peopleAtom, tasksAtom } from "../global-state"
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

type PeopleViewProps = {
  query: string
  view: ViewMode
  onQueryChange: (query: string) => void
  onViewChange: (view: ViewMode) => void
}

export function PeopleView({ query, view, onQueryChange, onViewChange }: PeopleViewProps) {
  const people = useAtomValue(peopleAtom)
  const allTasks = useAtomValue(tasksAtom)
  const send = useSetAtom(globalStateMachineAtom)
  const navigate = useNavigate()
  const deferredQuery = useDeferredValue(query)

  const createPerson = () => {
    const id = generateNoteId()
    const content = `---\ntype: person\n---\n\n# New Person\n`
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
      counts[person.id] = allTasks.filter((t) => !t.completed && t.links.includes(person.id)).length
    }
    return counts
  }, [people, allTasks])

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
          placeholder={`Search ${filteredPeople.length} people…`}
          value={query}
          onChange={onQueryChange}
        />
        <IconButton
          aria-label="New person"
          className="h-10 w-10 shrink-0 rounded-lg bg-bg-secondary text-text hover:bg-bg-secondary-hover! active:bg-bg-secondary-active! epaper:ring-1 epaper:ring-inset epaper:ring-border epaper:focus-visible:ring-2 coarse:h-12 coarse:w-12"
          onClick={createPerson}
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
      {filteredPeople.length === 0 ? (
        people.length === 0 ? (
          <EmptyState
            icon={<Users size={28} />}
            title="No people yet"
            description="Add `type: person` to a note's frontmatter to track contacts."
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
          {filteredPeople.map((person) => (
            <PersonListItem
              key={person.id}
              person={person}
              taskCount={taskCounts[person.id] ?? 0}
            />
          ))}
        </ul>
      ) : (
        <div className={cx("grid gap-4", gridCols[view])}>
          {filteredPeople.map((person) => (
            <PersonGridCard
              key={person.id}
              person={person}
              taskCount={taskCounts[person.id] ?? 0}
            />
          ))}
        </div>
      )}
    </div>
  )
}

function PersonGridCard({ person, taskCount }: { person: Note; taskCount: number }) {
  const role = person.frontmatter.role as string | undefined
  const team = person.frontmatter.team as string | undefined

  return (
    <Link
      to="/notes/$"
      params={{ _splat: person.id }}
      search={{ mode: "read", query: undefined, view: "grid" }}
      draggable={false}
      className="card-1 group flex flex-col overflow-hidden rounded-lg transition-[outline] hover:outline hover:outline-2 hover:outline-[var(--neutral-7)]"
    >
      {/* Content preview */}
      <div className="grow overflow-hidden [mask-image:linear-gradient(to_bottom,black_0%,black_60%,transparent_100%)]">
        <NotePreview note={person} hideProperties />
      </div>
      {/* Footer */}
      {role || team || taskCount > 0 ? (
        <div className="flex flex-col gap-0.5 px-3 pb-3 text-[11px] text-text-tertiary">
          {role ? <span className="truncate">{role}</span> : null}
          {team ? <span className="truncate">{team}</span> : null}
          {taskCount > 0 ? <span>{taskCount} pending tasks</span> : null}
        </div>
      ) : null}
    </Link>
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
        draggable={false}
        className="card-1 flex items-center justify-between gap-3 rounded-lg px-4 py-3 transition-colors hover:bg-bg-secondary active:bg-bg-tertiary"
      >
        <div className="flex flex-col gap-1 overflow-hidden">
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
