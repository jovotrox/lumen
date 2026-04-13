import { useAtomValue, useSetAtom } from "jotai"
import React, { useDeferredValue, useMemo } from "react"
import { Link, useNavigate } from "@tanstack/react-router"
import { globalStateMachineAtom, peopleAtom, tasksAtom } from "../global-state"
import { generateNoteId } from "../utils/note-id"
import { Plus, Search, Users } from "lucide-react"
import { SearchInput } from "./search-input"
import { DropdownMenu } from "./dropdown-menu"
import { EmptyState } from "./empty-state"
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

  return (
    <div className="flex flex-col gap-4">
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
      ) : (
        <ul className="flex flex-col gap-2">
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
        className="card-1 flex items-center justify-between gap-3 rounded-lg px-4 py-3"
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
