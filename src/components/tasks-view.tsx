import { Link } from "@tanstack/react-router"
import { motion } from "motion/react"
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useInView } from "react-intersection-observer"
import { useDebounce } from "use-debounce"
import { useSearchTasks } from "../hooks/search-tasks"
import { useSaveNote } from "../hooks/note"
import { Note } from "../schema"
import { parseQuery } from "../utils/search"
import { formatNumber, pluralize } from "../utils/pluralize"
import { scheduleTask } from "../utils/task"
import { Button } from "./button"
import { DropdownMenu } from "./dropdown-menu"
import { IconButton } from "./icon-button"
import {
  GlobeIcon16,
  GridIcon16,
  ListIcon16,
  PinFillIcon12,
  TagFillIcon12,
  TagIcon12,
  TagIcon16,
  XIcon12,
} from "./icons"
import { LinkHighlightProvider } from "./link-highlight-provider"
import { NoteFavicon } from "./note-favicon"
import { NotePreviewCard } from "./note-preview-card"
import { PillButton } from "./pill-button"
import { SearchInput } from "./search-input"
import { TaskListItemWrapper } from "./task-list-item-wrapper"

type View = "grid" | "list"

const viewIcons: Record<View, React.ReactNode> = {
  grid: <GridIcon16 />,
  list: <ListIcon16 />,
}

type TasksViewProps = {
  query: string
  view: View
  onQueryChange: (query: string) => void
  onViewChange: (view: View) => void
}

const initialVisibleTasks = 10
const initialVisibleNotes = 6

export function TasksView({ query, view, onQueryChange, onViewChange }: TasksViewProps) {
  const searchTasks = useSearchTasks()
  const saveNote = useSaveNote()

  // Task item animation
  const [shouldAnimateTasks, setShouldAnimateTasks] = useState(false)
  const animationTimeoutRef = useRef<number>()
  const enableTaskAnimation = useCallback(() => {
    setShouldAnimateTasks(true)
    clearTimeout(animationTimeoutRef.current)
    animationTimeoutRef.current = window.setTimeout(() => {
      setShouldAnimateTasks(false)
    }, 400)
  }, [])
  useEffect(() => {
    return () => clearTimeout(animationTimeoutRef.current)
  }, [])

  const [deferredQuery] = useDebounce(query, 150)

  // Base query filters only incomplete tasks
  const baseQuery = "completed:false"
  const fullQuery = `${baseQuery} ${deferredQuery}`.trim()

  const taskResults = useMemo(() => {
    return searchTasks(`${fullQuery} sort:date,priority`)
  }, [searchTasks, fullQuery])

  // Derive unique notes from task results
  const notesWithTasks = useMemo(() => {
    const noteMap = new Map<string, Note>()
    for (const task of taskResults) {
      if (!noteMap.has(task.note.id)) {
        noteMap.set(task.note.id, task.note)
      }
    }
    return [...noteMap.values()]
  }, [taskResults])

  const [numVisibleTasks, setNumVisibleTasks] = useState(initialVisibleTasks)
  const [numVisibleNotes, setNumVisibleNotes] = useState(initialVisibleNotes)

  const [tasksBottomRef, tasksBottomInView] = useInView()
  const [notesBottomRef, notesBottomInView] = useInView()

  const loadMoreTasks = React.useCallback(() => {
    setNumVisibleTasks((num) => Math.min(num + 10, taskResults.length))
  }, [taskResults.length])

  const loadMoreNotes = React.useCallback(() => {
    setNumVisibleNotes((num) => Math.min(num + 6, notesWithTasks.length))
  }, [notesWithTasks.length])

  React.useEffect(() => {
    if (tasksBottomInView) {
      loadMoreTasks()
    }
  }, [tasksBottomInView, loadMoreTasks])

  React.useEffect(() => {
    if (notesBottomInView) {
      loadMoreNotes()
    }
  }, [notesBottomInView, loadMoreNotes])

  // Reset visible counts when query changes
  React.useEffect(() => {
    setNumVisibleTasks(initialVisibleTasks)
    setNumVisibleNotes(initialVisibleNotes)
  }, [deferredQuery])

  const numVisibleTags = 4

  const sortedTagFrequencies = React.useMemo(() => {
    const frequencyMap = new Map<string, number>()

    const tags = taskResults.flatMap((result) => result.tags)

    for (const tag of tags) {
      frequencyMap.set(tag, (frequencyMap.get(tag) ?? 0) + 1)
    }

    const frequencyEntries = [...frequencyMap.entries()]

    return (
      frequencyEntries
        // Filter out tags that every task has
        .filter(([, frequency]) => frequency < taskResults.length)
        // Filter out parent tags if all child tags have the same frequency
        .filter(([tag, frequency]) => {
          const childTags = frequencyEntries.filter(
            ([otherTag]) => otherTag !== tag && otherTag.startsWith(tag),
          )

          if (childTags.length === 0) return true

          return !childTags.every(([, otherFrequency]) => otherFrequency === frequency)
        })
        .sort((a, b) => {
          return b[1] - a[1]
        })
    )
  }, [taskResults])

  const filters = React.useMemo(() => {
    return parseQuery(query).filters
  }, [query])

  const tagFilters = React.useMemo(() => {
    return filters.filter((filter) => filter.key === "tag")
  }, [filters])

  const highlightPaths = React.useMemo(() => {
    return filters
      .filter((filter) => !filter.exclude)
      .flatMap((filter) => {
        switch (filter.key) {
          case "tag":
            return filter.values.map((value) => `/tags/${value}`)
          case "link":
            return filter.values.map((value) => `/${value}`)
          case "date":
            return filter.values.map((value) => `/${value}`)
          default:
            return []
        }
      })
  }, [filters])

  return (
    <LinkHighlightProvider href={highlightPaths}>
      <div className="flex flex-col gap-6">
        {/* Search and filters */}
        <div className="flex flex-col gap-4">
          <div className="flex gap-2">
            <SearchInput
              placeholder={`Search ${pluralize(taskResults.length, "task")}…`}
              value={query}
              autoCapitalize="off"
              spellCheck="false"
              onChange={(value) => {
                onQueryChange(value)
                setNumVisibleTasks(initialVisibleTasks)
                setNumVisibleNotes(initialVisibleNotes)
              }}
            />
            <DropdownMenu>
              <DropdownMenu.Trigger
                render={
                  <IconButton
                    aria-label="View"
                    className="h-10 w-10 shrink-0 rounded-lg bg-bg-secondary hover:bg-bg-secondary-hover! data-[popup-open]:bg-bg-secondary-hover! active:bg-bg-secondary-active! epaper:ring-1 epaper:ring-inset epaper:ring-border epaper:focus-visible:ring-2 coarse:h-12 coarse:w-12"
                  >
                    {viewIcons[view]}
                  </IconButton>
                }
              />
              <DropdownMenu.Content align="end" width={160}>
                <DropdownMenu.Group>
                  <DropdownMenu.GroupLabel>Notes view</DropdownMenu.GroupLabel>
                  <DropdownMenu.Item
                    icon={<GridIcon16 />}
                    onClick={() => onViewChange("grid")}
                    selected={view === "grid"}
                  >
                    Grid
                  </DropdownMenu.Item>
                  <DropdownMenu.Item
                    icon={<ListIcon16 />}
                    onClick={() => onViewChange("list")}
                    selected={view === "list"}
                  >
                    List
                  </DropdownMenu.Item>
                </DropdownMenu.Group>
              </DropdownMenu.Content>
            </DropdownMenu>
          </div>
          {sortedTagFrequencies.length > 0 || tagFilters.length > 0 || deferredQuery ? (
            <div className="flex flex-col gap-3">
              <div className="flex flex-wrap gap-2 empty:hidden">
                {sortedTagFrequencies.length > 0 || tagFilters.length > 0 ? (
                  <>
                    {tagFilters.map((filter) => (
                      <PillButton
                        key={filter.values.join(",")}
                        data-tag={filter.values.join(",")}
                        variant="primary"
                        onClick={() => {
                          const text = `${filter.exclude ? "-" : ""}tag:${filter.values.join(",")}`

                          const index = query.indexOf(text)

                          if (index === -1) return

                          const newQuery =
                            query.slice(0, index) + query.slice(index + text.length).trimStart()

                          onQueryChange(newQuery.trim())
                        }}
                      >
                        <TagFillIcon12 />
                        {filter.exclude ? <span className="italic">not</span> : null}
                        {filter.values.map((value, index) => (
                          <React.Fragment key={value}>
                            {index > 0 ? <span>or</span> : null}
                            <span key={value}>{value}</span>
                          </React.Fragment>
                        ))}
                        <XIcon12 className="-mr-0.5" />
                      </PillButton>
                    ))}
                    {sortedTagFrequencies.slice(0, numVisibleTags).map(([tag, frequency]) => (
                      <PillButton
                        key={tag}
                        data-tag={tag}
                        onClick={(event) => {
                          const qualifier = `${event.shiftKey ? "-" : ""}tag:${tag}`

                          onQueryChange(query ? `${query} ${qualifier}` : qualifier)

                          setTimeout(() => {
                            document.querySelector<HTMLElement>(`[data-tag="${tag}"]`)?.focus()
                          })
                        }}
                      >
                        <TagIcon12 className="text-text-secondary" />
                        {tag}
                        <span className="text-text-secondary">{formatNumber(frequency)}</span>
                      </PillButton>
                    ))}
                    {sortedTagFrequencies.length > numVisibleTags ? (
                      <DropdownMenu>
                        <DropdownMenu.Trigger
                          render={
                            <PillButton variant="dashed" className="data-[popup-open]:bg-bg-hover">
                              Show more
                            </PillButton>
                          }
                        />
                        <DropdownMenu.Content width={300}>
                          {sortedTagFrequencies.slice(numVisibleTags).map(([tag, frequency]) => (
                            <DropdownMenu.Item
                              key={tag}
                              icon={<TagIcon16 />}
                              trailingVisual={
                                <span className="text-text-secondary epaper:text-current">
                                  {frequency}
                                </span>
                              }
                              onClick={(event) => {
                                const qualifier = `${event.shiftKey ? "-" : ""}tag:${tag}`
                                onQueryChange(query ? `${query} ${qualifier}` : qualifier)
                              }}
                            >
                              {tag}
                            </DropdownMenu.Item>
                          ))}
                        </DropdownMenu.Content>
                      </DropdownMenu>
                    ) : null}
                  </>
                ) : null}
              </div>
              {deferredQuery ? (
                <div className="text-sm text-text-secondary leading-4">
                  {pluralize(taskResults.length, "result")}
                </div>
              ) : null}
            </div>
          ) : null}
        </div>

        {/* Tasks section */}
        <div className="flex flex-col gap-3">
          <h2 className="text-sm font-medium text-text-secondary">
            Tasks ({formatNumber(taskResults.length)})
          </h2>
          <ul className="flex flex-col gap-0.5">
            {taskResults.slice(0, numVisibleTasks).map((task) => (
              <motion.li
                key={`${task.note.id}-${task.startOffset}`}
                layout="position"
                transition={{
                  layout: {
                    type: "tween",
                    duration: shouldAnimateTasks ? 0.2 : 0,
                    ease: [0.2, 0, 0, 1],
                  },
                }}
                className="list-none"
              >
                <TaskListItemWrapper
                  task={task}
                  onMutate={enableTaskAnimation}
                  onSchedule={(date) => {
                    const updatedContent = scheduleTask({
                      content: task.note.content,
                      task,
                      date,
                    })

                    if (updatedContent !== task.note.content) {
                      saveNote({ id: task.note.id, content: updatedContent })
                    }
                  }}
                />
              </motion.li>
            ))}
          </ul>
          {taskResults.length > numVisibleTasks ? (
            <Button ref={tasksBottomRef} className="w-full" onClick={loadMoreTasks}>
              Load more tasks
            </Button>
          ) : null}
        </div>

        {/* Notes section */}
        {notesWithTasks.length > 0 ? (
          <div className="flex flex-col gap-3">
            <h2 className="text-sm font-medium text-text-secondary">
              Notes ({formatNumber(notesWithTasks.length)})
            </h2>
            {view === "grid" ? (
              <div className="grid grid-cols-[repeat(auto-fill,minmax(300px,1fr))] gap-4">
                {notesWithTasks.slice(0, numVisibleNotes).map((note) => (
                  <NotePreviewCard key={note.id} id={note.id} />
                ))}
              </div>
            ) : null}
            {view === "list" ? (
              <ul className="flex flex-col gap-0.5">
                {notesWithTasks.slice(0, numVisibleNotes).map((note) => {
                  return (
                    <li key={note.id}>
                      <Link
                        to="/notes/$"
                        params={{ _splat: note.id }}
                        search={{
                          mode: "read",
                          query: undefined,
                          view: "grid",
                        }}
                        className="focus-ring flex h-10 items-center rounded-lg px-3 hover:bg-bg-hover coarse:h-12 coarse:p-4"
                      >
                        <NoteFavicon note={note} className="mr-3 coarse:mr-4" />
                        {note.pinned ? (
                          <PinFillIcon12 className="mr-2 coarse:mr-3 shrink-0 text-text-pinned" />
                        ) : null}
                        {note?.frontmatter?.gist_id ? (
                          <GlobeIcon16 className="mr-2 coarse:mr-3 shrink-0 text-border-focus" />
                        ) : null}
                        <span className="truncate text-text-secondary">
                          <span className="text-text">{note.displayName}</span>
                        </span>
                      </Link>
                    </li>
                  )
                })}
              </ul>
            ) : null}
            {notesWithTasks.length > numVisibleNotes ? (
              <Button ref={notesBottomRef} className="w-full" onClick={loadMoreNotes}>
                Load more notes
              </Button>
            ) : null}
          </div>
        ) : null}
      </div>
    </LinkHighlightProvider>
  )
}
