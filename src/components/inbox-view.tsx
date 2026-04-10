import { useAtomValue, useSetAtom } from "jotai"
import React, { useDeferredValue, useMemo, useState } from "react"
import { Link } from "@tanstack/react-router"
import { CheckSquare, FileText, FolderOpen, Inbox as InboxIcon, User } from "lucide-react"
import {
  aiProviderAtom,
  claudeApiKeyAtom,
  globalStateMachineAtom,
  inboxAtom,
  notesAtom,
  openaiKeyAtom,
  peopleAtom,
  projectsAtom,
  sortedNotesAtom,
} from "../global-state"
import { SearchInput } from "./search-input"
import { Button } from "./button"
import { LoadingIcon16 } from "./icons"
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
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2">
        <SearchInput
          placeholder={`Search ${filtered.length} inbox items…`}
          value={query}
          onChange={onQueryChange}
        />
      </div>
      {filtered.length === 0 ? (
        <div className="text-text-secondary text-sm">
          {inboxItems.length === 0
            ? "Inbox is empty. Use Quick Note in Inbox mode to capture items."
            : "No inbox items match your search."}
        </div>
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
  const people = useAtomValue(peopleAtom)
  const projects = useAtomValue(projectsAtom)
  const recentNotes = useAtomValue(sortedNotesAtom)
  const notes = useAtomValue(notesAtom)
  const send = useSetAtom(globalStateMachineAtom)

  const apiKey = aiProvider === "openai" ? openaiKey : claudeKey
  const hasKey = apiKey !== ""

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
      type: type === "task" ? undefined : type,
      status: type === "project" ? "active" : "converted",
    }

    if (type !== "inbox") {
      properties.source = undefined
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
      const checkboxLine = `- [ ] ${title} [[${item.id}]]`
      const existingNote = notes.get(today)

      if (existingNote) {
        const content = existingNote.content.trimEnd() + "\n" + checkboxLine + "\n"
        filesToWrite[`${today}.md`] = content
      } else {
        filesToWrite[`${today}.md`] = `# ${today}\n\n${checkboxLine}\n`
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
            <div className="text-xs text-text-secondary">
              Related:{" "}
              {suggestion.related_notes.map((id, i) => (
                <span key={id}>
                  {i > 0 ? ", " : ""}
                  <Link
                    to="/notes/$"
                    params={{ _splat: id }}
                    search={{ mode: "read", query: undefined, view: "grid" }}
                    className="link"
                  >
                    {renderPreview(`[[${id}]]`)}
                  </Link>
                </span>
              ))}
            </div>
          ) : null}
          <div className="flex gap-2">
            <Button
              size="small"
              variant="primary"
              onClick={() => convertToNote(suggestion.suggested_type)}
            >
              Convert to {suggestion.suggested_type}
            </Button>
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
