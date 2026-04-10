# Phase 2: Smart Inbox + Quick Note Dual Mode — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a Smart Inbox system where Quick Note can send items to an inbox for AI-powered classification, with a dedicated `/inbox` page to process items (convert to tasks/notes, link to existing notes, or ignore).

**Architecture:** Quick Note gets a Note/Inbox toggle. Inbox items are regular notes with `type: inbox` frontmatter. A new `/inbox` route shows unprocessed items with AI suggestions. AI classification calls the user's configured provider (OpenAI or Claude) directly from the client using keys stored in localStorage. A heuristic fallback parser handles classification when no API key is configured.

**Tech Stack:** React, TypeScript, Jotai, TanStack Router, OpenAI API, Anthropic API, Tailwind CSS

---

## File Structure

| File                               | Responsibility                                     | Action |
| ---------------------------------- | -------------------------------------------------- | ------ |
| `src/routes/quick-note.tsx`        | Add Note/Inbox toggle                              | Modify |
| `src/routes/_appRoot.tsx`          | Handle inbox mode in quick-note-save listener      | Modify |
| `src/global-state.ts`              | Add inboxAtom, AI config atoms                     | Modify |
| `src/utils/ai-classify.ts`         | AI provider abstraction + heuristic fallback       | Create |
| `src/components/inbox-view.tsx`    | Inbox list UI with AI suggestions                  | Create |
| `src/routes/_appRoot.inbox.tsx`    | /inbox route                                       | Create |
| `src/components/ai-key-input.tsx`  | Generic API key input (reusable for OpenAI/Claude) | Create |
| `src/routes/_appRoot.settings.tsx` | Add Claude key + AI provider selector              | Modify |

---

### Task 1: Add AI config atoms to global state

**Files:**

- Modify: `src/global-state.ts`

- [ ] **Step 1: Add AI configuration atoms**

After the existing `voiceAssistantEnabledAtom` (around line 912), add:

```typescript
// -----------------------------------------------------------------------------
// AI Classification
// -----------------------------------------------------------------------------

export const CLAUDE_KEY_STORAGE_KEY = "claude_api_key"

export const claudeApiKeyAtom = atomWithStorage<string>(CLAUDE_KEY_STORAGE_KEY, "")

export const hasClaudeKeyAtom = selectAtom(claudeApiKeyAtom, (key) => key !== "")

export const aiProviderAtom = atomWithStorage<"openai" | "claude">("ai_provider", "openai")

export const quickNoteModeAtom = atomWithStorage<"note" | "inbox">("quick_note_mode", "inbox")
```

- [ ] **Step 2: Add inboxAtom derived state**

After the People section in global-state.ts (after `personSearcherAtom`), add:

```typescript
// -----------------------------------------------------------------------------
// Inbox
// -----------------------------------------------------------------------------

export const inboxAtom = atom((get) => {
  const notes = get(notesAtom)
  const items: Note[] = []

  for (const note of notes.values()) {
    if (note.type === "inbox") {
      items.push(note)
    }
  }

  // Sort by updatedAt descending (newest first)
  return items.sort((a, b) => (b.updatedAt ?? 0) - (a.updatedAt ?? 0))
})
```

- [ ] **Step 3: Verify build**

Run: `npm run build 2>&1 | tail -5`

- [ ] **Step 4: Commit**

```bash
git add src/global-state.ts
git commit -m "feat: add AI config atoms, quickNoteModeAtom, and inboxAtom"
```

---

### Task 2: Add Note/Inbox toggle to Quick Note

**Files:**

- Modify: `src/routes/quick-note.tsx`

- [ ] **Step 1: Import atoms and SegmentedControl**

Add to the imports at the top:

```typescript
import { SegmentedControl } from "../components/segmented-control"
import { quickNoteModeAtom } from "../global-state"
import { useAtom } from "jotai"
```

Change the existing `import { useAtomValue } from "jotai"` to `import { useAtom, useAtomValue } from "jotai"`.

- [ ] **Step 2: Add mode state**

Inside `QuickNoteComponent`, after the existing `useAtomValue` calls (around line 26), add:

```typescript
const [mode, setMode] = useAtom(quickNoteModeAtom)
```

- [ ] **Step 3: Include mode in the save event payload**

In the `handleSave` callback, change the `emitTo` call to include mode:

```typescript
// Before:
await emitTo("main", "quick-note-save", {
  noteId,
  content,
})

// After:
await emitTo("main", "quick-note-save", {
  noteId,
  content,
  mode,
})
```

- [ ] **Step 4: Add toggle to the header UI**

In the JSX, replace the header `<span>` that says "Quick Note" with:

```typescript
// Before:
<span className="text-xs font-medium text-text-secondary">Quick Note</span>

// After:
<SegmentedControl aria-label="Quick note mode" size="small">
  <SegmentedControl.Segment
    selected={mode === "note"}
    onClick={() => setMode("note")}
  >
    Note
  </SegmentedControl.Segment>
  <SegmentedControl.Segment
    selected={mode === "inbox"}
    onClick={() => setMode("inbox")}
  >
    Inbox
  </SegmentedControl.Segment>
</SegmentedControl>
```

- [ ] **Step 5: Verify build**

Run: `npm run build 2>&1 | tail -5`

- [ ] **Step 6: Commit**

```bash
git add src/routes/quick-note.tsx
git commit -m "feat: add Note/Inbox toggle to Quick Note"
```

---

### Task 3: Handle inbox mode in quick-note-save listener

**Files:**

- Modify: `src/routes/_appRoot.tsx` (lines 81-109)

- [ ] **Step 1: Update the listener to handle mode**

Find the `quick-note-save` listener (around line 89). Change the event type and handling:

```typescript
// Before:
unlisten = await listen<{ noteId: string; content: string }>("quick-note-save", (event) => {
  const { noteId, content } = event.payload
  // Add updated_at timestamp to the note
  const contentWithTimestamp = updateFrontmatterValue({
    content,
    properties: { updated_at: new Date() },
  })
  // Save the note using the global state machine
  send({
    type: "WRITE_FILES",
    markdownFiles: { [`${noteId}.md`]: contentWithTimestamp },
  })
})

// After:
unlisten = await listen<{ noteId: string; content: string; mode: "note" | "inbox" }>(
  "quick-note-save",
  (event) => {
    const { noteId, content, mode } = event.payload

    const properties: Record<string, unknown> = { updated_at: new Date() }

    if (mode === "inbox") {
      properties.type = "inbox"
      properties.status = "unprocessed"
      properties.source = "quick-note"
    }

    const enrichedContent = updateFrontmatterValue({
      content,
      properties,
    })

    send({
      type: "WRITE_FILES",
      markdownFiles: { [`${noteId}.md`]: enrichedContent },
    })
  },
)
```

- [ ] **Step 2: Verify build**

Run: `npm run build 2>&1 | tail -5`

- [ ] **Step 3: Commit**

```bash
git add src/routes/_appRoot.tsx
git commit -m "feat: handle inbox mode in quick-note-save listener"
```

---

### Task 4: Create AI classification utility

**Files:**

- Create: `src/utils/ai-classify.ts`

- [ ] **Step 1: Create the classification module**

Create `src/utils/ai-classify.ts`:

```typescript
import type { Note } from "../schema"

export type InboxSuggestion = {
  suggested_type: "task" | "note" | "project" | "person"
  title: string
  project: string | null
  person: string | null
  priority: 1 | 2 | 3 | null
  tags: string[]
  related_notes: string[]
  confidence: number
}

const SYSTEM_PROMPT = `You are a work input classifier for a personal note-taking app. Given raw text, extract structured information.

Known people: {people}
Known projects: {projects}
Recent notes: {recentNotes}

Respond with ONLY valid JSON matching this schema:
{
  "suggested_type": "task" | "note" | "project" | "person",
  "title": "concise title",
  "project": "project-note-id or null",
  "person": "person-note-id or null",
  "priority": 1 | 2 | 3 | null,
  "tags": ["tag1", "tag2"],
  "related_notes": ["note-id-1", "note-id-2"],
  "confidence": 0.0 to 1.0
}

Rules:
- Input may be Spanish or English
- Match against known entities when possible
- Only suggest related_notes from the provided list
- suggested_type "task" = actionable item, "note" = information, "project" = new project, "person" = new person entry
- priority 1 = highest urgency`

function buildPrompt(context: { people: Note[]; projects: Note[]; recentNotes: Note[] }): string {
  const people = context.people.map((p) => `${p.id} (${p.displayName})`).join(", ") || "none"
  const projects = context.projects.map((p) => `${p.id} (${p.displayName})`).join(", ") || "none"
  const recentNotes =
    context.recentNotes
      .slice(0, 20)
      .map((n) => `${n.id} (${n.displayName})`)
      .join(", ") || "none"

  return SYSTEM_PROMPT.replace("{people}", people)
    .replace("{projects}", projects)
    .replace("{recentNotes}", recentNotes)
}

export async function classifyWithOpenAI(
  text: string,
  apiKey: string,
  context: { people: Note[]; projects: Note[]; recentNotes: Note[] },
): Promise<InboxSuggestion> {
  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: buildPrompt(context) },
        { role: "user", content: text },
      ],
      response_format: { type: "json_object" },
      temperature: 0.1,
    }),
  })

  if (!response.ok) {
    throw new Error(`OpenAI API error: ${response.status}`)
  }

  const data = await response.json()
  return JSON.parse(data.choices[0].message.content) as InboxSuggestion
}

export async function classifyWithClaude(
  text: string,
  apiKey: string,
  context: { people: Note[]; projects: Note[]; recentNotes: Note[] },
): Promise<InboxSuggestion> {
  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "anthropic-dangerous-direct-browser-access": "true",
    },
    body: JSON.stringify({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 512,
      system: buildPrompt(context),
      messages: [{ role: "user", content: text }],
    }),
  })

  if (!response.ok) {
    throw new Error(`Claude API error: ${response.status}`)
  }

  const data = await response.json()
  const content = data.content[0].text
  return JSON.parse(content) as InboxSuggestion
}

export function classifyWithHeuristics(
  text: string,
  context: { people: Note[]; projects: Note[]; recentNotes: Note[] },
): InboxSuggestion {
  const lower = text.toLowerCase()

  // Detect type
  let suggested_type: InboxSuggestion["suggested_type"] = "note"
  const taskPatterns =
    /\b(hacer|do|fix|send|review|talk|hablar|enviar|revisar|check|update|deploy|need to|hay que|should|must|todo)\b/
  if (taskPatterns.test(lower)) {
    suggested_type = "task"
  }

  // Detect priority
  let priority: 1 | 2 | 3 | null = null
  if (/\b(urgent|urgente|asap|critical|crítico)\b/.test(lower)) {
    priority = 1
  } else if (/\b(important|importante)\b/.test(lower)) {
    priority = 2
  }

  // Detect person via @mentions or known people
  let person: string | null = null
  const mention = text.match(/@(\w+)/)
  if (mention) {
    const found = context.people.find(
      (p) =>
        p.id.toLowerCase() === mention[1].toLowerCase() ||
        p.displayName.toLowerCase() === mention[1].toLowerCase(),
    )
    if (found) person = found.id
  }
  if (!person) {
    for (const p of context.people) {
      if (lower.includes(p.displayName.toLowerCase()) || lower.includes(p.id.toLowerCase())) {
        person = p.id
        break
      }
    }
  }

  // Detect project via #tags or known projects
  let project: string | null = null
  const hashtag = text.match(/#(\w+)/)
  if (hashtag) {
    const found = context.projects.find(
      (p) =>
        p.id.toLowerCase() === hashtag[1].toLowerCase() ||
        p.displayName.toLowerCase() === hashtag[1].toLowerCase(),
    )
    if (found) project = found.id
  }
  if (!project) {
    for (const p of context.projects) {
      if (lower.includes(p.displayName.toLowerCase()) || lower.includes(p.id.toLowerCase())) {
        project = p.id
        break
      }
    }
  }

  // Extract tags
  const tags = (text.match(/#(\w+)/g) ?? []).map((t) => t.slice(1))

  // Find related notes by keyword overlap
  const words = lower.split(/\s+/).filter((w) => w.length > 3)
  const related_notes = context.recentNotes
    .filter((n) => {
      const noteText = (n.displayName + " " + n.id).toLowerCase()
      return words.some((w) => noteText.includes(w))
    })
    .slice(0, 3)
    .map((n) => n.id)

  // Title: first sentence or first 80 chars
  const title = text.split(/[.\n]/)[0].slice(0, 80).trim() || text.slice(0, 80).trim()

  return {
    suggested_type,
    title,
    project,
    person,
    priority,
    tags,
    related_notes,
    confidence: 0.3,
  }
}

export async function classifyInboxItem(
  text: string,
  provider: "openai" | "claude" | "heuristic",
  apiKey: string,
  context: { people: Note[]; projects: Note[]; recentNotes: Note[] },
): Promise<InboxSuggestion> {
  try {
    if (provider === "openai" && apiKey) {
      return await classifyWithOpenAI(text, apiKey, context)
    }
    if (provider === "claude" && apiKey) {
      return await classifyWithClaude(text, apiKey, context)
    }
  } catch (error) {
    console.error("AI classification failed, falling back to heuristics:", error)
  }
  return classifyWithHeuristics(text, context)
}
```

- [ ] **Step 2: Verify build**

Run: `npm run build 2>&1 | tail -5`

- [ ] **Step 3: Commit**

```bash
git add src/utils/ai-classify.ts
git commit -m "feat: add AI classification with OpenAI, Claude, and heuristic fallback"
```

---

### Task 5: Create Inbox view component

**Files:**

- Create: `src/components/inbox-view.tsx`

- [ ] **Step 1: Create the component**

Create `src/components/inbox-view.tsx`:

```typescript
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
  const [state, send] = useAtomValue(globalStateMachineAtom)

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
```

- [ ] **Step 2: Verify build**

Run: `npm run build 2>&1 | tail -5`

- [ ] **Step 3: Commit**

```bash
git add src/components/inbox-view.tsx
git commit -m "feat: create InboxView component with AI classification"
```

---

### Task 6: Create /inbox route

**Files:**

- Create: `src/routes/_appRoot.inbox.tsx`

- [ ] **Step 1: Create the route file**

Create `src/routes/_appRoot.inbox.tsx`:

```typescript
import { createFileRoute } from "@tanstack/react-router"
import { Inbox } from "lucide-react"
import { PageLayout } from "../components/page-layout"
import { InboxView } from "../components/inbox-view"

type RouteSearch = {
  query: string | undefined
}

export const Route = createFileRoute("/_appRoot/inbox")({
  validateSearch: (search: Record<string, unknown>): RouteSearch => {
    return {
      query: typeof search.query === "string" ? search.query : undefined,
    }
  },
  component: RouteComponent,
  head: () => ({
    meta: [{ title: "Inbox · Lumen" }],
  }),
})

function RouteComponent() {
  const { query } = Route.useSearch()
  const navigate = Route.useNavigate()

  return (
    <PageLayout title="Inbox" icon={<Inbox size={16} />}>
      <div className="p-4 pt-0">
        <InboxView
          query={query ?? ""}
          onQueryChange={(query) =>
            navigate({ search: (prev) => ({ ...prev, query }), replace: true })
          }
        />
      </div>
    </PageLayout>
  )
}
```

- [ ] **Step 2: Add Inbox to sidebar navigation**

In `src/components/nav-items.tsx`, add an import:

```typescript
import { Inbox } from "lucide-react"
```

Then add a new `<li>` after the People nav link:

```typescript
            <li>
              <NavLink
                to="/inbox"
                search={{ query: undefined }}
                icon={<Inbox size={16} />}
                onNavigate={onNavigate}
              >
                Inbox
              </NavLink>
            </li>
```

- [ ] **Step 3: Verify build**

Run: `npm run build 2>&1 | tail -5`

- [ ] **Step 4: Commit**

```bash
git add src/routes/_appRoot.inbox.tsx src/components/nav-items.tsx
git commit -m "feat: add /inbox route and sidebar link"
```

---

### Task 7: Add Claude API key input and AI provider selector to Settings

**Files:**

- Create: `src/components/ai-key-input.tsx`
- Modify: `src/routes/_appRoot.settings.tsx`

- [ ] **Step 1: Create reusable AI key input component**

Create `src/components/ai-key-input.tsx`:

```typescript
import { useAtom } from "jotai"
import type { PrimitiveAtom } from "jotai"
import { TextInput } from "./text-input"
import { FormControl } from "./form-control"

export function AIKeyInput({
  label,
  atom: keyAtom,
  placeholder,
}: {
  label: string
  atom: PrimitiveAtom<string>
  placeholder: string
}) {
  const [value, setValue] = useAtom(keyAtom)

  return (
    <FormControl htmlFor={label.toLowerCase().replace(/\s+/g, "-")} label={label}>
      <TextInput
        id={label.toLowerCase().replace(/\s+/g, "-")}
        name={label.toLowerCase().replace(/\s+/g, "-")}
        type="password"
        value={value}
        onChange={(event) => setValue(event.target.value)}
        placeholder={placeholder}
      />
    </FormControl>
  )
}
```

- [ ] **Step 2: Update AISection in settings**

In `src/routes/_appRoot.settings.tsx`, update the imports to add:

```typescript
import { AIKeyInput } from "../components/ai-key-input"
import { SegmentedControl } from "../components/segmented-control"
```

And add to the existing global-state import:

```typescript
aiProviderAtom, claudeApiKeyAtom,
```

Then modify the `AISection` component. Add the AI provider selector and Claude key input before the voice assistant section. Find the existing `AISection` function and add after `<OpenAIKeyInput />`:

```typescript
        <div role="separator" className="h-px bg-border-secondary" />
        <div className="flex items-center justify-between">
          <span className="leading-4">AI provider</span>
          <SegmentedControl aria-label="AI provider" size="small">
            <SegmentedControl.Segment
              selected={aiProvider === "openai"}
              onClick={() => setAiProvider("openai")}
            >
              OpenAI
            </SegmentedControl.Segment>
            <SegmentedControl.Segment
              selected={aiProvider === "claude"}
              onClick={() => setAiProvider("claude")}
            >
              Claude
            </SegmentedControl.Segment>
          </SegmentedControl>
        </div>
        <AIKeyInput label="Claude key" atom={claudeApiKeyAtom} placeholder="sk-ant-…" />
```

Add the atom hooks at the top of `AISection`:

```typescript
const [aiProvider, setAiProvider] = useAtom(aiProviderAtom)
```

- [ ] **Step 3: Verify build**

Run: `npm run build 2>&1 | tail -5`

- [ ] **Step 4: Commit**

```bash
git add src/components/ai-key-input.tsx src/routes/_appRoot.settings.tsx
git commit -m "feat: add Claude API key input and AI provider selector to settings"
```

---

### Task 8: Format, lint, build, and manual test

**Files:** All modified files

- [ ] **Step 1: Format**

Run: `npm run format`

- [ ] **Step 2: Lint**

Run: `npm run lint`

- [ ] **Step 3: Build**

Run: `npm run build 2>&1 | tail -10`

- [ ] **Step 4: Manual testing with tauri:dev**

Run: `npm run tauri:dev`

Test checklist:

1. Quick Note shows Note/Inbox toggle — default is Inbox
2. Save in Inbox mode → note created with `type: inbox` frontmatter
3. Navigate to `/inbox` → shows unprocessed items
4. Click "Classify" on an inbox item → shows AI suggestion (or heuristic)
5. Click "Convert to task/note" → item disappears from inbox
6. Click "Ignore" → item disappears from inbox
7. Settings shows AI provider toggle and Claude key input
8. Sidebar shows Inbox link

- [ ] **Step 5: Commit format changes**

```bash
npm run format
git add -A
git commit -m "chore: format and lint cleanup for Phase 2"
```
