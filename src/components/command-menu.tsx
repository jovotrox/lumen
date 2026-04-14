import { useMatch, useNavigate } from "@tanstack/react-router"
import { parseDate } from "chrono-node"
import { Command } from "cmdk"
import copy from "copy-to-clipboard"
import { atom, useAtom, useAtomValue } from "jotai"
import { useCallback, useMemo, useRef, useState } from "react"
import { useHotkeys } from "react-hotkeys-hook"
import { useDebounce } from "use-debounce"
import {
  githubRepoAtom,
  pinnedNotesAtom,
  tagSearcherAtom,
  unprocessedInboxCountAtom,
} from "../global-state"
import { useNoteById, useSaveNote } from "../hooks/note"
import { useSearchNotes } from "../hooks/search-notes"
import { useTabs } from "../hooks/use-tabs"
import { Note } from "../schema"
import { formatDate, formatDateDistance, toDateString } from "../utils/date"
import { generateNoteId } from "../utils/note-id"
import { pluralize } from "../utils/pluralize"
import { FolderOpen, Home, Inbox, User } from "lucide-react"
import {
  CalendarDateIcon16,
  CopyIcon16,
  ExternalLinkIcon16,
  GlobeIcon16,
  LinkIcon16,
  NoteIcon16,
  PinFillIcon12,
  PlusIcon16,
  PrinterIcon16,
  SearchIcon16,
  SettingsIcon16,
  TagIcon16,
  TaskListIcon16,
} from "./icons"
import { NoteFavicon } from "./note-favicon"

export const isCommandMenuOpenAtom = atom(false)
/** When true, the next Command Menu selection opens in a new tab instead of replacing the current one. */
export const commandMenuNewTabAtom = atom(false)

export function CommandMenu() {
  const navigate = useNavigate()
  const githubRepo = useAtomValue(githubRepoAtom)
  const searchNotes = useSearchNotes()
  const tagSearcher = useAtomValue(tagSearcherAtom)
  const saveNote = useSaveNote()
  const pinnedNotes = useAtomValue(pinnedNotesAtom)
  const inboxCount = useAtomValue(unprocessedInboxCountAtom)
  const [isOpen, setIsOpen] = useAtom(isCommandMenuOpenAtom)
  const [isNewTab, setIsNewTab] = useAtom(commandMenuNewTabAtom)
  const { openTab } = useTabs()

  // Get the current note if we're on a note page.
  // This is used to show note actions in the command menu.
  const noteMatch = useMatch({ from: "/_appRoot/notes_/$", shouldThrow: false })
  const noteId = noteMatch?.params._splat
  const note = useNoteById(noteId)

  // Refs
  const prevActiveElement = useRef<HTMLElement>()

  // Local state
  const [query, setQuery] = useState("")
  const [deferredQuery] = useDebounce(query, 150)

  const openMenu = useCallback(() => {
    prevActiveElement.current = document.activeElement as HTMLElement
    setIsOpen(true)
  }, [setIsOpen])

  const closeMenu = useCallback(() => {
    setIsOpen(false)
    setIsNewTab(false)
    setTimeout(() => {
      prevActiveElement.current?.focus()
    })
  }, [setIsOpen, setIsNewTab])

  const toggleMenu = useCallback(() => {
    if (isOpen) {
      closeMenu()
    } else {
      openMenu()
    }
  }, [isOpen, openMenu, closeMenu])

  // Capture isNewTab at selection time so the flag is read before being reset
  const isNewTabRef = useRef(false)
  isNewTabRef.current = isNewTab

  /**
   * Wrap a command menu item callback. When triggered from the + button
   * (isNewTab), pass the destination `path` so a new tab is created
   * without relying on async URL reads.
   */
  const handleSelect = useCallback(
    (callback: () => void, path?: string) => {
      return () => {
        const shouldOpenTab = isNewTabRef.current
        setIsOpen(false)
        setIsNewTab(false)
        setQuery("")
        callback()
        if (shouldOpenTab && path) {
          openTab(path, path)
        }
      }
    },
    [setIsOpen, setIsNewTab, openTab],
  )

  useHotkeys("mod+k", toggleMenu, {
    preventDefault: true,
    enableOnFormTags: true,
    enableOnContentEditable: true,
  })

  const navItems = useMemo(() => {
    return [
      { label: "Home", path: "/", icon: <Home size={16} /> },
      {
        label: "Inbox",
        path: "/inbox",
        icon: <Inbox size={16} />,
        badge:
          inboxCount > 0 ? (
            <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-border-focus px-1 text-[10px] font-medium text-bg">
              {inboxCount}
            </span>
          ) : null,
      },
      {
        label: "Calendar",
        path: `/notes/${toDateString(new Date())}`,
        icon: <CalendarDateIcon16 date={new Date().getDate()} />,
      },
      { label: "Notes", path: "/notes", icon: <NoteIcon16 /> },
      { label: "Projects", path: "/projects", icon: <FolderOpen size={16} /> },
      { label: "Tasks", path: "/tasks", icon: <TaskListIcon16 /> },
      { label: "Links", path: "/links", icon: <LinkIcon16 /> },
      { label: "People", path: "/people", icon: <User size={16} /> },
      { label: "Tags", path: "/tags", icon: <TagIcon16 /> },
      { label: "Settings", path: "/settings", icon: <SettingsIcon16 /> },
    ]
  }, [inboxCount])

  const filteredNavItems = useMemo(() => {
    return navItems.filter((item) => {
      return item.label.toLowerCase().includes(deferredQuery.toLowerCase())
    })
  }, [navItems, deferredQuery])

  const noteActions = useMemo(() => {
    if (!note) return []
    return [
      // TODO: Get the codemirror instance and update the editor value when pinning/unpinning
      // {
      //   label: note.pinned ? "Unpin note" : "Pin note",
      //   icon: note.pinned ? <PinFillIcon16 className="text-text-pinned" /> : <PinIcon16 />,
      //   onSelect: () => {
      //     saveNote({
      //       id: note.id,
      //       content: updateFrontmatter({
      //         content: note.content,
      //         properties: { pinned: note.pinned ? null : true },
      //       }),
      //     })
      //   },
      // },
      {
        label: "Copy note markdown",
        icon: <CopyIcon16 />,
        onSelect: () => {
          copy(note.content)
        },
      },
      {
        label: "Copy note ID",
        icon: <CopyIcon16 />,
        onSelect: () => {
          copy(note.id)
        },
      },
      {
        label: "Open in GitHub",
        icon: <ExternalLinkIcon16 />,
        onSelect: () => {
          if (!githubRepo) return
          const url = `https://github.com/${githubRepo.owner}/${githubRepo.name}/blob/main/${note.id}.md`
          window.open(url, "_blank")
        },
      },
      {
        label: "Print note",
        icon: <PrinterIcon16 />,
        onSelect: () => {
          window.print()
        },
      },
    ]
  }, [note, githubRepo])

  const filteredNoteActions = useMemo(() => {
    return noteActions.filter((item) => {
      return item.label.toLowerCase().includes(deferredQuery.toLowerCase())
    })
  }, [noteActions, deferredQuery])

  // Check if query can be parsed as a date
  const dateString = useMemo(() => {
    const date = parseDate(deferredQuery)
    if (!date) return ""
    return toDateString(date)
  }, [deferredQuery])

  // Search tags
  const tagResults = useMemo(() => {
    return tagSearcher.search(deferredQuery)
  }, [tagSearcher, deferredQuery])

  // Search notes
  const noteResults = useMemo(() => {
    return searchNotes(deferredQuery)
  }, [searchNotes, deferredQuery])

  // Only show the first 2 tags
  const numVisibleTags = 2

  // Only show the first 6 notes
  const numVisibleNotes = 6

  return (
    <Command.Dialog
      label="Global command menu"
      open={isOpen}
      onOpenChange={(open) => {
        if (open) {
          openMenu()
        } else {
          closeMenu()
        }
      }}
      shouldFilter={false}
      onKeyDown={(event) => {
        // Clear input with `esc`
        if (event.key === "Escape" && query) {
          setQuery("")
          event.preventDefault()
        }
      }}
    >
      <div className="card-3 overflow-hidden rounded-xl!">
        <Command.Input
          placeholder="Search or jump to…"
          value={query}
          onValueChange={setQuery}
          autoCapitalize="off"
        />

        <Command.List>
          {filteredNoteActions.length > 0 ? (
            <Command.Group heading="Note actions">
              {filteredNoteActions.map((action) => (
                <CommandItem
                  key={action.label}
                  icon={action.icon}
                  onSelect={handleSelect(action.onSelect)}
                >
                  {action.label}
                </CommandItem>
              ))}
            </Command.Group>
          ) : null}
          {filteredNavItems.length ? (
            <Command.Group heading="Jump to">
              {filteredNavItems.map((item) => (
                <CommandItem
                  key={item.label}
                  icon={item.icon}
                  badge={item.badge}
                  onSelect={handleSelect(() => navigate({ to: item.path }), item.path)}
                >
                  {item.label}
                </CommandItem>
              ))}
            </Command.Group>
          ) : null}
          {!deferredQuery && pinnedNotes.length ? (
            <Command.Group heading="Pinned notes">
              {pinnedNotes.map((note) => (
                <NoteItem
                  key={note.id}
                  note={note}
                  // Since they're all pinned, we don't need to show the pin icon
                  hidePinIcon
                  onSelect={handleSelect(
                    () =>
                      navigate({
                        to: "/notes/$",
                        params: { _splat: note.id },
                        search: { mode: "read", query: undefined, view: "grid" },
                      }),
                    `/notes/${note.id}`,
                  )}
                />
              ))}
            </Command.Group>
          ) : null}
          {dateString ? (
            <Command.Group heading="Date">
              <CommandItem
                key={dateString}
                icon={<CalendarDateIcon16 date={new Date(dateString).getUTCDate()} />}
                description={formatDateDistance(dateString)}
                onSelect={handleSelect(
                  () =>
                    navigate({
                      to: "/notes/$",
                      params: { _splat: dateString },
                      search: { mode: "read", query: undefined, view: "grid" },
                    }),
                  `/notes/${dateString}`,
                )}
              >
                {formatDate(dateString)}
              </CommandItem>
            </Command.Group>
          ) : null}
          {tagResults.length ? (
            <Command.Group heading="Tags">
              {tagResults.slice(0, numVisibleTags).map(([name, noteIds]) => (
                <CommandItem
                  key={name}
                  icon={<TagIcon16 />}
                  description={pluralize(noteIds.length, "note")}
                  onSelect={handleSelect(
                    () =>
                      navigate({
                        to: "/tags/$",
                        params: { _splat: name },
                        search: { query: undefined, view: "grid" },
                      }),
                    `/tags/${name}`,
                  )}
                >
                  {name}
                </CommandItem>
              ))}
              {tagResults.length > numVisibleTags ? (
                <CommandItem
                  key={`Show all tags matching "${deferredQuery}"`}
                  icon={<SearchIcon16 />}
                  onSelect={handleSelect(
                    () =>
                      navigate({
                        to: "/tags",
                        search: { query: deferredQuery, sort: "name", view: "list" },
                      }),
                    "/tags",
                  )}
                >
                  Show all {pluralize(tagResults.length, "tag")} matching "{deferredQuery}"
                </CommandItem>
              ) : null}
            </Command.Group>
          ) : null}
          {deferredQuery ? (
            <Command.Group heading="Notes">
              {noteResults.slice(0, numVisibleNotes).map((note) => (
                <NoteItem
                  key={note.id}
                  note={note}
                  onSelect={handleSelect(
                    () =>
                      navigate({
                        to: "/notes/$",
                        params: { _splat: note.id },
                        search: { mode: "read", query: undefined, view: "grid" },
                      }),
                    `/notes/${note.id}`,
                  )}
                />
              ))}
              {noteResults.length > 0 ? (
                <CommandItem
                  key={`Show all notes matching "${deferredQuery}"`}
                  icon={<SearchIcon16 />}
                  onSelect={handleSelect(
                    () => navigate({ to: "/", search: { query: deferredQuery, view: "grid" } }),
                    "/",
                  )}
                >
                  Show all {pluralize(noteResults.length, "note")} matching "{deferredQuery}"
                </CommandItem>
              ) : null}
              <CommandItem
                key={`Create new note "${deferredQuery}"`}
                icon={<PlusIcon16 />}
                onSelect={() => {
                  const shouldOpen = isNewTabRef.current
                  setIsOpen(false)
                  setIsNewTab(false)
                  setQuery("")
                  const id = generateNoteId()
                  saveNote({ id, content: `# ${deferredQuery}` })
                  navigate({
                    to: "/notes/$",
                    params: { _splat: id },
                    search: { mode: "write", query: undefined, view: "grid" },
                  })
                  if (shouldOpen) openTab(`/notes/${id}`, id)
                }}
              >
                Create new note "{deferredQuery}"
              </CommandItem>
            </Command.Group>
          ) : null}
        </Command.List>
      </div>
    </Command.Dialog>
  )
}

type CommandItemProps = {
  children: React.ReactNode
  value?: string
  icon?: React.ReactNode
  description?: string
  badge?: React.ReactNode
  onSelect?: () => void
}

function CommandItem({ children, value, icon, description, badge, onSelect }: CommandItemProps) {
  return (
    <Command.Item value={value} onSelect={onSelect}>
      <div className="flex items-center gap-3">
        <div className="grid h-4 w-4 place-items-center text-text-secondary">{icon}</div>
        <div className="grow truncate">{children}</div>
        {badge}
        {description ? <span className="shrink-0 text-text-secondary">{description}</span> : null}
        <span className="hidden leading-none text-text-secondary in-aria-selected:inline epaper:in-aria-selected:text-bg">
          ⏎
        </span>
      </div>
    </Command.Item>
  )
}

function NoteItem({
  note,
  hidePinIcon,
  onSelect,
}: {
  note: Note
  hidePinIcon?: boolean
  onSelect: () => void
}) {
  return (
    <CommandItem
      key={note.id}
      value={note.id}
      icon={<NoteFavicon note={note} />}
      onSelect={onSelect}
    >
      <span className="flex items-center gap-2 truncate">
        {!hidePinIcon && note.pinned ? (
          <PinFillIcon12 className="shrink-0 text-text-pinned" />
        ) : null}
        {note?.frontmatter?.gist_id ? <GlobeIcon16 className="shrink-0 text-border-focus" /> : null}
        <span className="truncate">{note.displayName}</span>
      </span>
    </CommandItem>
  )
}
