import { addDays, format, isWeekend, nextMonday, nextSaturday } from "date-fns"
import React, { useCallback, useMemo, useRef, useState } from "react"
import { useNoteById, useSaveNote } from "../hooks/note"
import type { TaskWithNote } from "../schema"
import { cx } from "../utils/cx"
import { toDateString } from "../utils/date"
import { deleteTask as deleteTaskUtil } from "../utils/task"
import { DropdownMenu } from "./dropdown-menu"
import { CalendarDateIcon16, CircleSlashIcon16 } from "./icons"
import { ListItemExtensionsContext, MarkdownContent, MarkdownContext } from "./markdown"
import { NoteEditor } from "./note-editor"
import { NoteLink } from "./note-link"

type TaskListItemWrapperProps = {
  task: TaskWithNote
  className?: string
  onMutate?: () => void
  onSchedule?: (date: string | null) => void
}

export function TaskListItemWrapper({
  task,
  className,
  onMutate,
  onSchedule,
}: TaskListItemWrapperProps) {
  const saveNote = useSaveNote()
  const note = useNoteById(task.note.id)
  const noteLabel = note?.displayName ?? task.note.id

  const [mode, setMode] = useState<"read" | "write">("read")
  const [pendingText, setPendingText] = useState(task.text)
  const buttonRef = useRef<HTMLDivElement>(null)

  // Build the task markdown line from the task data
  const checkbox = task.completed ? "- [x]" : "- [ ]"
  const taskMarkdown = `${checkbox} ${task.text}`

  // onChange: when ListItem modifies the markdownBody (checkbox, priority, delete, etc.)
  const handleChange = useCallback(
    (newBody: string) => {
      onMutate?.()

      if (!newBody.trim()) {
        // Deletion
        const updatedContent = deleteTaskUtil({ content: task.note.content, task })
        if (updatedContent !== task.note.content) {
          saveNote({ id: task.note.id, content: updatedContent })
        }
        return
      }

      // Replace task line in note content
      const content = task.note.content
      const start = task.startOffset
      let end = start
      while (end < content.length && content[end] !== "\n") end++
      const updatedContent = content.slice(0, start) + newBody + content.slice(end)
      if (updatedContent !== content) {
        saveNote({ id: task.note.id, content: updatedContent })
      }
    },
    [task, saveNote, onMutate],
  )

  // MarkdownContext for ListItem
  const contextValue = useMemo(
    () => ({
      markdown: task.note.content,
      markdownBody: taskMarkdown,
      markdownBodyStartOffset: task.startOffset,
      onChange: handleChange,
      noteId: task.note.id,
      isReadMode: false,
    }),
    [task.note.content, taskMarkdown, task.startOffset, handleChange, task.note.id],
  )

  // Schedule menu items injected into ListItem's dropdown via context
  const scheduleMenuItems = useMemo(() => {
    if (!onSchedule) return undefined

    const handleSchedule = (date: string | null) => {
      onMutate?.()
      onSchedule(date)
    }

    return (
      <>
        <DropdownMenu.Group>
          <DropdownMenu.GroupLabel>Schedule</DropdownMenu.GroupLabel>
          {(() => {
            const today = new Date()
            return task.date !== toDateString(today) ? (
              <DropdownMenu.Item
                icon={<CalendarDateIcon16 date={today.getDate()} />}
                onClick={() => handleSchedule(toDateString(today))}
                trailingVisual={<span className="text-text-secondary">{format(today, "EEE")}</span>}
              >
                Today
              </DropdownMenu.Item>
            ) : null
          })()}
          {(() => {
            const tomorrow = addDays(new Date(), 1)
            return task.date !== toDateString(tomorrow) ? (
              <DropdownMenu.Item
                icon={<CalendarDateIcon16 date={tomorrow.getDate()} />}
                onClick={() => handleSchedule(toDateString(tomorrow))}
                trailingVisual={
                  <span className="text-text-secondary">{format(tomorrow, "EEE")}</span>
                }
              >
                Tomorrow
              </DropdownMenu.Item>
            ) : null
          })()}
          {(() => {
            const now = new Date()
            const weekendDate = nextSaturday(now)
            const label = isWeekend(now) ? "Next weekend" : "This weekend"
            return task.date !== toDateString(weekendDate) ? (
              <DropdownMenu.Item
                icon={<CalendarDateIcon16 date={weekendDate.getDate()} />}
                onClick={() => handleSchedule(toDateString(weekendDate))}
                trailingVisual={
                  <span className="text-text-secondary">{format(weekendDate, "EEE MMM d")}</span>
                }
              >
                {label}
              </DropdownMenu.Item>
            ) : null
          })()}
          {(() => {
            const mondayDate = nextMonday(new Date())
            return task.date !== toDateString(mondayDate) ? (
              <DropdownMenu.Item
                icon={<CalendarDateIcon16 date={mondayDate.getDate()} />}
                onClick={() => handleSchedule(toDateString(mondayDate))}
                trailingVisual={
                  <span className="text-text-secondary">{format(mondayDate, "EEE MMM d")}</span>
                }
              >
                Next week
              </DropdownMenu.Item>
            ) : null
          })()}
          {task.date !== null ? (
            <DropdownMenu.Item icon={<CircleSlashIcon16 />} onClick={() => handleSchedule(null)}>
              No date
            </DropdownMenu.Item>
          ) : null}
        </DropdownMenu.Group>
        <DropdownMenu.Separator />
      </>
    )
  }, [task.date, onSchedule, onMutate])

  const extensionsValue = useMemo(
    () => ({ extraMenuItems: scheduleMenuItems }),
    [scheduleMenuItems],
  )

  // Inline editing handlers
  const commitChange = useCallback(() => {
    if (pendingText !== task.text) {
      onMutate?.()
      const content = task.note.content
      const start = task.startOffset
      let end = start
      while (end < content.length && content[end] !== "\n") end++
      const currentLine = content.slice(start, end)
      // Replace just the text portion (after "- [ ] " or "- [x] ")
      const newLine = currentLine.slice(0, 6) + pendingText
      const updatedContent = content.slice(0, start) + newLine + content.slice(end)
      if (updatedContent !== content) {
        saveNote({ id: task.note.id, content: updatedContent })
      }
    }
  }, [pendingText, task, saveNote, onMutate])

  const stopPropagationOnDoubleClick = useCallback((event: React.MouseEvent<HTMLDivElement>) => {
    if (event.detail > 1) {
      event.stopPropagation()
    }
  }, [])

  const handleBlur = useCallback(
    (event: React.FocusEvent<HTMLDivElement>) => {
      const nextFocusTarget = event.relatedTarget as Node | null
      if (!event.currentTarget.contains(nextFocusTarget)) {
        commitChange()
        setTimeout(() => setMode("read"))
      }
    },
    [commitChange],
  )

  const handleButtonClick = useCallback(
    (event: React.MouseEvent<HTMLDivElement>) => {
      const target = event.target as HTMLElement | null
      if (!event.currentTarget.contains(target)) return
      if (
        target?.closest(
          "a,button,input,textarea,select,summary,[contenteditable='true'],[contenteditable='']",
        )
      ) {
        return
      }
      setPendingText(task.text)
      setMode("write")
    },
    [task.text],
  )

  const handleButtonKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLDivElement>) => {
      if (event.defaultPrevented) return
      if (event.target !== event.currentTarget) return
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault()
        setPendingText(task.text)
        setMode("write")
      }
    },
    [task.text],
  )

  const handleEscape = useCallback(
    (event: React.KeyboardEvent<HTMLDivElement>) => {
      if (event.key === "Escape") {
        event.preventDefault()
        event.stopPropagation()
        commitChange()
        setMode("read")
        setTimeout(() => buttonRef.current?.focus())
      }
    },
    [commitChange],
  )

  const handleEnter = useCallback(() => {
    commitChange()
    setMode("read")
    setTimeout(() => buttonRef.current?.focus())
    return true
  }, [commitChange])

  return (
    <div
      role="button"
      ref={buttonRef}
      className={cx(
        "focus-ring cursor-text rounded-lg @container",
        mode === "write" && "ring-2 ring-inset ring-border-focus",
        className,
      )}
      tabIndex={0}
      onMouseDown={stopPropagationOnDoubleClick}
      onKeyDown={mode === "read" ? handleButtonKeyDown : undefined}
      onClick={mode === "read" ? handleButtonClick : undefined}
    >
      {mode === "read" ? (
        <div className="grid @md:grid-cols-[1fr_auto] @md:items-start">
          <MarkdownContext.Provider value={contextValue}>
            <ListItemExtensionsContext.Provider value={extensionsValue}>
              <div className="[&_.markdown]:m-0 [&_ul]:m-0 [&_ul]:p-0 [&_ul]:list-none">
                <MarkdownContent>{taskMarkdown}</MarkdownContent>
              </div>
            </ListItemExtensionsContext.Provider>
          </MarkdownContext.Provider>
          <div className="@md:h-7 flex h-6 items-center truncate text-text-secondary px-1.5">
            <NoteLink
              id={task.note.id}
              text={noteLabel}
              className="link truncate @md:max-w-52"
              hoverCardAlign="end"
            />
          </div>
        </div>
      ) : (
        <div className="flex gap-1 p-1.5">
          <div className="size-7 coarse:size-9 shrink-0" />
          {/* eslint-disable-next-line jsx-a11y/no-static-element-interactions */}
          <div className="min-w-0 flex-1" onBlur={handleBlur} onKeyDown={handleEscape}>
            <NoteEditor
              defaultValue={pendingText}
              placeholder=""
              // eslint-disable-next-line jsx-a11y/no-autofocus
              autoFocus={true}
              indentWithTab={false}
              onChange={setPendingText}
              onEnter={handleEnter}
            />
          </div>
        </div>
      )}
    </div>
  )
}
