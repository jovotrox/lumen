import { useAtomValue, useSetAtom } from "jotai"
import React, { useDeferredValue, useMemo, useState } from "react"
import { Link } from "@tanstack/react-router"
import {
  aiProviderAtom,
  claudeApiKeyAtom,
  globalStateMachineAtom,
  inboxAtom,
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
  const send = useSetAtom(globalStateMachineAtom)

  const apiKey = aiProvider === "openai" ? openaiKey : claudeKey
  const hasKey = apiKey !== ""

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

    // Remove inbox-specific fields
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

    send({
      type: "WRITE_FILES",
      markdownFiles: { [`${item.id}.md`]: updated },
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
          <Link
            to="/notes/$"
            params={{ _splat: item.id }}
            search={{ mode: "read", query: undefined, view: "grid" }}
            className="link truncate font-medium"
          >
            {item.displayName}
          </Link>
          <p className="line-clamp-2 text-sm text-text-secondary">{preview.slice(0, 200)}</p>
        </div>
        <span className="shrink-0 text-xs text-text-tertiary">
          {item.frontmatter.source as string}
        </span>
      </div>

      {suggestion ? (
        <div className="flex flex-col gap-2 rounded bg-bg-secondary p-3 text-sm">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded bg-bg-tertiary px-1.5 py-0.5 text-xs font-medium">
              {suggestion.suggested_type}
            </span>
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
              {Math.round(suggestion.confidence * 100)}% confidence
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
                    {id}
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
            <Button size="small" onClick={ignoreItem}>
              Ignore
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex gap-2">
          <Button size="small" variant="primary" onClick={classify} disabled={loading}>
            {loading ? (
              <span className="flex items-center gap-1">
                <LoadingIcon16 /> Classifying…
              </span>
            ) : (
              `Classify${hasKey ? ` with ${aiProvider === "openai" ? "OpenAI" : "Claude"}` : " (heuristic)"}`
            )}
          </Button>
          <Button size="small" onClick={ignoreItem}>
            Ignore
          </Button>
        </div>
      )}

      {error ? <p className="text-xs text-text-danger">{error}</p> : null}
    </div>
  )
}
