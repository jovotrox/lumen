import { useAtomValue, useSetAtom } from "jotai"
import React, { useDeferredValue, useMemo, useState } from "react"
import { Link } from "@tanstack/react-router"
import {
  CheckSquare,
  ChevronDown,
  FileText,
  FolderOpen,
  Inbox as InboxIcon,
  User,
} from "lucide-react"
import {
  aiProviderAtom,
  claudeApiKeyAtom,
  globalStateMachineAtom,
  inboxAtom,
  notesAtom,
  ollamaModelAtom,
  ollamaUrlAtom,
  openaiKeyAtom,
  peopleAtom,
  projectsAtom,
  sortedNotesAtom,
} from "../global-state"
import { SearchInput } from "./search-input"
import { Button } from "./button"
import { DropdownMenu } from "./dropdown-menu"
import { EmptyState } from "./empty-state"
import { Tooltip } from "./tooltip"
import { LoadingIcon16 } from "./icons"
import { Search } from "lucide-react"
import { classifyInboxItem, type InboxSuggestion } from "../utils/ai-classify"
import { updateFrontmatterValue } from "../utils/frontmatter"
import { toDateString } from "../utils/date"
import type { Note } from "../schema"

type InboxViewProps = {
  query: string
  onQueryChange: (query: string) => void
}

export function InboxView({ query, onQueryChange }: InboxViewProps) {
  const inboxItems = useAtomValue(inboxAtom)
  const deferredQuery = useDeferredValue(query)

  const unprocessed = useMemo(
    () =>
      inboxItems.filter((item) => {
        const status = item.frontmatter.status as string
        return status === "unprocessed" || status === "processed"
      }),
    [inboxItems],
  )

  const filtered = useMemo(() => {
    if (!deferredQuery) return unprocessed
    const lower = deferredQuery.toLowerCase()
    return unprocessed.filter(
      (item) =>
        item.displayName.toLowerCase().includes(lower) ||
        item.content.toLowerCase().includes(lower),
    )
  }, [unprocessed, deferredQuery])

  return (
    <div className="flex flex-1 flex-col gap-4">
      <div className="flex items-center gap-2">
        <SearchInput
          placeholder={`Search ${filtered.length} inbox items…`}
          value={query}
          onChange={onQueryChange}
        />
      </div>
      {filtered.length === 0 ? (
        inboxItems.length === 0 ? (
          <EmptyState
            icon={<InboxIcon size={28} />}
            title="Inbox zero"
            description="Nothing to triage. Capture thoughts with ⌥⇧N in Inbox mode."
          />
        ) : (
          <EmptyState
            icon={<Search size={28} />}
            title="No matches"
            description="Try different search terms."
          />
        )
      ) : (
        <ul className="flex flex-col gap-3">
          {filtered.map((item) => (
            <InboxItemCard key={item.id} item={item} />
          ))}
        </ul>
      )}
    </div>
  )
}

/** Extract a friendly title from inbox item content (first line of body, or first N chars) */
function friendlyTitle(item: Note): string {
  const body = item.content.replace(/^---[\s\S]*?---\n*/, "").trim()
  const firstLine = body
    .split("\n")[0]
    .replace(/^#+\s*/, "")
    .trim()
  return firstLine || item.displayName
}

/** Render preview text, replacing raw wikilinks with display names */
function renderPreview(text: string): string {
  return text.replace(/\[\[([^\]|]+)\|([^\]]+)\]\]/g, "$2").replace(/\[\[([^\]]+)\]\]/g, "$1")
}

const typeConfig: Record<string, { icon: React.ReactNode; color: string; label: string }> = {
  task: { icon: <CheckSquare size={12} />, color: "text-text-success", label: "Task" },
  note: { icon: <FileText size={12} />, color: "text-border-focus", label: "Note" },
  project: { icon: <FolderOpen size={12} />, color: "text-text-pending", label: "Project" },
  person: { icon: <User size={12} />, color: "text-text-secondary", label: "Person" },
}

function TypeBadge({ type }: { type: string }) {
  const config = typeConfig[type] ?? {
    icon: <InboxIcon size={12} />,
    color: "text-text-tertiary",
    label: type,
  }
  return (
    <span
      className={`flex items-center gap-1 rounded bg-bg-tertiary px-1.5 py-0.5 text-xs font-medium ${config.color}`}
    >
      {config.icon}
      {config.label}
    </span>
  )
}

function InboxItemCard({ item }: { item: Note }) {
  const [suggestion, setSuggestion] = useState<InboxSuggestion | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const aiProvider = useAtomValue(aiProviderAtom)
  const openaiKey = useAtomValue(openaiKeyAtom)
  const claudeKey = useAtomValue(claudeApiKeyAtom)
  const ollamaUrl = useAtomValue(ollamaUrlAtom)
  const ollamaModel = useAtomValue(ollamaModelAtom)
  const people = useAtomValue(peopleAtom)
  const projects = useAtomValue(projectsAtom)
  const recentNotes = useAtomValue(sortedNotesAtom)
  const notes = useAtomValue(notesAtom)
  const send = useSetAtom(globalStateMachineAtom)

  const apiKey = aiProvider === "openai" ? openaiKey : claudeKey
  const hasKey = aiProvider === "ollama" || apiKey !== ""

  // Auto-classify unprocessed items on mount using heuristics
  React.useEffect(() => {
    if (item.frontmatter.status !== "unprocessed") return
    if (suggestion || loading) return

    classifyInboxItem(item.content, "heuristic", "", { people, projects, recentNotes })
      .then((result) => setSuggestion(result))
      .catch(() => {})
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [item.id])

  const classify = async () => {
    setLoading(true)
    setError(null)
    try {
      const result = await classifyInboxItem(
        item.content,
        hasKey ? aiProvider : "heuristic",
        apiKey,
        { people, projects, recentNotes },
        ollamaUrl,
        ollamaModel,
      )
      setSuggestion(result)

      // Mark as processed
      const updated = updateFrontmatterValue({
        content: item.content,
        properties: { status: "processed" },
      })
      send({
        type: "WRITE_FILES",
        markdownFiles: { [`${item.id}.md`]: updated },
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : "Classification failed")
    } finally {
      setLoading(false)
    }
  }

  const convertToNote = (type: string) => {
    const properties: Record<string, unknown> = {
      type: type === "task" ? null : type,
      status: type === "project" ? "active" : "converted",
      source: null,
    }

    if (suggestion?.priority) {
      properties.priority = suggestion.priority
    }

    const updated = updateFrontmatterValue({
      content: item.content,
      properties,
    })

    const filesToWrite: Record<string, string> = {
      [`${item.id}.md`]: updated,
    }

    // For tasks, append a checkbox to today's daily note
    if (type === "task") {
      const today = toDateString(new Date())
      const title = friendlyTitle(item)
      const checkboxLine = `- [ ] ${title}`
      const existingNote = notes.get(today)

      if (existingNote) {
        const content = existingNote.content.trimEnd() + "\n" + checkboxLine + "\n"
        filesToWrite[`${today}.md`] = content
      } else {
        filesToWrite[`${today}.md`] = `${checkboxLine}\n`
      }
    }

    send({
      type: "WRITE_FILES",
      markdownFiles: filesToWrite,
    })
  }

  const ignoreItem = () => {
    const updated = updateFrontmatterValue({
      content: item.content,
      properties: { status: "ignored" },
    })
    send({
      type: "WRITE_FILES",
      markdownFiles: { [`${item.id}.md`]: updated },
    })
  }

  // Strip frontmatter for preview
  const preview = item.content.replace(/^---[\s\S]*?---\n*/, "").trim()

  return (
    <div className="card-1 flex flex-col gap-3 p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex flex-col gap-1 overflow-hidden">
          <div className="flex items-center gap-2">
            <Link
              to="/notes/$"
              params={{ _splat: item.id }}
              search={{ mode: "read", query: undefined, view: "grid" }}
              className="link truncate font-medium"
            >
              {friendlyTitle(item)}
            </Link>
            <span className="rounded bg-bg-tertiary px-1.5 py-0.5 text-[10px] font-medium text-text-secondary">
              {(item.frontmatter.status as string) === "unprocessed"
                ? "unsorted"
                : (item.frontmatter.status as string)}
            </span>
          </div>
          <p className="line-clamp-2 text-sm text-text-secondary">{renderPreview(preview)}</p>
        </div>
      </div>

      {suggestion ? (
        <div className="flex flex-col gap-2 rounded bg-bg-secondary p-3 text-sm">
          <div className="flex flex-wrap items-center gap-2">
            <TypeBadge type={suggestion.suggested_type} />
            {suggestion.priority ? (
              <span className="text-xs text-text-pending">Priority {suggestion.priority}</span>
            ) : null}
            {suggestion.person ? (
              <span className="text-xs text-text-secondary">→ {suggestion.person}</span>
            ) : null}
            {suggestion.project ? (
              <span className="text-xs text-text-secondary">in {suggestion.project}</span>
            ) : null}
            <span className="text-xs text-text-tertiary">
              {Math.round(suggestion.confidence * 100)}%
            </span>
          </div>
          {suggestion.related_notes.length > 0 ? (
            <div className="flex items-center gap-1 text-xs text-text-secondary">
              <span>Related:</span>
              {suggestion.related_notes.map((id) => (
                <RelatedNoteLink key={id} noteId={id} notes={notes} />
              ))}
            </div>
          ) : null}
          <div className="flex gap-2">
            <ConvertButton suggestedType={suggestion.suggested_type} onConvert={convertToNote} />
            {hasKey ? (
              <Button size="small" onClick={classify} disabled={loading}>
                {loading ? (
                  <span className="flex items-center gap-1">
                    <LoadingIcon16 /> Classifying…
                  </span>
                ) : (
                  `Re-classify with ${aiProvider === "openai" ? "OpenAI" : "Claude"}`
                )}
              </Button>
            ) : null}
            <Button size="small" onClick={ignoreItem}>
              Ignore
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex gap-2">
          {loading ? (
            <span className="flex items-center gap-1 text-sm text-text-secondary">
              <LoadingIcon16 /> Classifying…
            </span>
          ) : (
            <>
              <Button size="small" variant="primary" onClick={classify} disabled={loading}>
                {`Classify${hasKey ? ` with ${aiProvider === "openai" ? "OpenAI" : "Claude"}` : " (heuristic)"}`}
              </Button>
              <Button size="small" onClick={ignoreItem}>
                Ignore
              </Button>
            </>
          )}
        </div>
      )}

      {error ? <p className="text-xs text-text-danger">{error}</p> : null}
    </div>
  )
}

const convertTypes = [
  { type: "task", icon: <CheckSquare size={14} />, label: "Task" },
  { type: "note", icon: <FileText size={14} />, label: "Note" },
  { type: "project", icon: <FolderOpen size={14} />, label: "Project" },
  { type: "person", icon: <User size={14} />, label: "Person" },
] as const

function ConvertButton({
  suggestedType,
  onConvert,
}: {
  suggestedType: string
  onConvert: (type: string) => void
}) {
  const suggested = convertTypes.find((t) => t.type === suggestedType) ?? convertTypes[0]
  const others = convertTypes.filter((t) => t.type !== suggestedType)

  return (
    <div className="flex">
      <Button
        size="small"
        variant="primary"
        className="rounded-r-none"
        onClick={() => onConvert(suggested.type)}
      >
        Convert to {suggested.label}
      </Button>
      <DropdownMenu>
        <DropdownMenu.Trigger
          render={
            <button className="flex h-6 items-center rounded-r bg-text px-1 text-bg hover:opacity-90 active:opacity-80">
              <ChevronDown size={14} />
            </button>
          }
        />
        <DropdownMenu.Content align="start" width={180}>
          {others.map((t) => (
            <DropdownMenu.Item key={t.type} icon={t.icon} onClick={() => onConvert(t.type)}>
              Convert to {t.label}
            </DropdownMenu.Item>
          ))}
        </DropdownMenu.Content>
      </DropdownMenu>
    </div>
  )
}

function RelatedNoteLink({ noteId, notes }: { noteId: string; notes: Map<string, Note> }) {
  const note = notes.get(noteId)
  if (!note) return null

  const displayName = note.displayName
  const role = note.frontmatter.role as string | undefined
  const team = note.frontmatter.team as string | undefined
  const status = note.frontmatter.status as string | undefined
  const previewBody = note.content
    .replace(/^---[\s\S]*?---\n*/, "")
    .trim()
    .slice(0, 200)

  return (
    <Tooltip>
      <Tooltip.Trigger
        render={
          <Link
            to="/notes/$"
            params={{ _splat: noteId }}
            search={{ mode: "read", query: undefined, view: "grid" }}
            className="link"
          >
            {displayName}
          </Link>
        }
      />
      <Tooltip.Content side="top" className="max-w-64 text-xs">
        <div className="flex flex-col gap-1">
          <span className="font-medium">{displayName}</span>
          {note.type !== "note" && note.type !== "daily" ? (
            <span className="text-text-secondary">{note.type}</span>
          ) : null}
          {role ? (
            <span className="text-text-secondary">
              {role}
              {team ? ` · ${team}` : ""}
            </span>
          ) : null}
          {status ? <span className="text-text-secondary">Status: {status}</span> : null}
          {previewBody ? (
            <p className="line-clamp-3 text-text-secondary">{renderPreview(previewBody)}</p>
          ) : null}
        </div>
      </Tooltip.Content>
    </Tooltip>
  )
}
