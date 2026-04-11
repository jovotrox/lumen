# FlowOS Phase 2 Feedback Improvements

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement 7 UX improvements from Phase 2 user feedback on Quick Note, Inbox, Projects/People views, and editor autocomplete.

**Architecture:** Each improvement is a small, focused change to existing components. No new files needed — all changes modify existing React components, Jotai atoms, and CodeMirror completions. Task conversion (#5) adds a helper function to append checkboxes to daily notes.

**Tech Stack:** React 18, Jotai, CodeMirror 6, TanStack Router, Tailwind CSS, Lucide React icons

---

## File Map

| File                               | Changes                                                                    |
| ---------------------------------- | -------------------------------------------------------------------------- |
| `src/routes/quick-note.tsx`        | Add Cmd+Enter keyboard shortcut (save + close)                             |
| `src/components/inbox-view.tsx`    | Display improvements, classify badges, pre-classification, task conversion |
| `src/components/nav-items.tsx`     | Inbox badge with unprocessed count                                         |
| `src/global-state.ts`              | Add `unprocessedInboxCountAtom`                                            |
| `src/components/projects-view.tsx` | "+ New project" button                                                     |
| `src/components/people-view.tsx`   | "+ New person" button                                                      |
| `src/components/note-editor.tsx`   | Frontmatter property value autocomplete                                    |

---

### Task 1: Cmd+Enter save+close in Quick Note

**Files:**

- Modify: `src/routes/quick-note.tsx:126-141` (keyboard handler)
- Modify: `src/routes/quick-note.tsx:189-191` (footer shortcuts text)

- [ ] **Step 1: Add Cmd+Enter handler**

In `src/routes/quick-note.tsx`, inside the `handleKeyDown` function (line 127), add a Cmd+Enter case that saves then closes:

```tsx
const handleKeyDown = (e: KeyboardEvent) => {
  // Cmd/Ctrl + Enter to save and close
  if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
    e.preventDefault()
    handleSave().then(() => closeWindow())
    return
  }
  // Cmd/Ctrl + S to save
  if ((e.metaKey || e.ctrlKey) && e.key === "s") {
    e.preventDefault()
    handleSave()
  }
  // Escape to close (with double-press for unsaved changes)
  if (e.key === "Escape") {
    e.preventDefault()
    handleEsc()
  }
}
```

- [ ] **Step 2: Update footer shortcuts text**

Change the footer shortcuts (line 189-191) to show all three:

```tsx
<div className="flex items-center justify-between text-[10px] text-text-tertiary">
  <span>⌘S save · ⌘↵ save+close</span>
  <span>ESC to close</span>
</div>
```

- [ ] **Step 3: Verify build**

Run: `npm run build`
Expected: No TypeScript errors

- [ ] **Step 4: Commit**

```bash
git add src/routes/quick-note.tsx
git commit -m "feat: add Cmd+Enter save+close to Quick Note"
```

---

### Task 2: Inbox display improvements + sidebar badge

**Files:**

- Modify: `src/global-state.ts:901-913` (add unprocessed count atom)
- Modify: `src/components/nav-items.tsx:1,13,166-175` (import atom, show badge)
- Modify: `src/components/inbox-view.tsx:159-176` (card title, status badge, wikilink rendering)

- [ ] **Step 1: Add `unprocessedInboxCountAtom` to global state**

In `src/global-state.ts`, after the `inboxAtom` definition (line 913), add:

```ts
export const unprocessedInboxCountAtom = atom((get) => {
  const notes = get(notesAtom)
  let count = 0
  for (const note of notes.values()) {
    if (note.type === "inbox" && note.frontmatter.status === "unprocessed") {
      count++
    }
  }
  return count
})
```

- [ ] **Step 2: Add sidebar badge to Inbox nav item**

In `src/components/nav-items.tsx`:

Add import for `unprocessedInboxCountAtom`:

```tsx
import {
  globalStateMachineAtom,
  isHelpPanelOpenAtom,
  notesAtom,
  pinnedNotesAtom,
  unprocessedInboxCountAtom,
} from "../global-state"
```

Inside the `NavItems` component, read the count:

```tsx
const inboxCount = useAtomValue(unprocessedInboxCountAtom)
```

Replace the Inbox `<li>` (lines 166-175) with:

```tsx
<li>
  <NavLink
    to="/inbox"
    search={{ query: undefined }}
    icon={<Inbox size={16} />}
    onNavigate={onNavigate}
  >
    <span className="flex items-center gap-2">
      Inbox
      {inboxCount > 0 ? (
        <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-border-focus px-1 text-[10px] font-medium text-bg">
          {inboxCount}
        </span>
      ) : null}
    </span>
  </NavLink>
</li>
```

- [ ] **Step 3: Improve inbox card display**

In `src/components/inbox-view.tsx`, improve the `InboxItemCard` title and add status badge.

Replace the card header section (lines 161-176) with:

```tsx
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
```

Add these helper functions before `InboxItemCard`:

```tsx
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
```

- [ ] **Step 4: Verify build**

Run: `npm run build`
Expected: No TypeScript errors

- [ ] **Step 5: Commit**

```bash
git add src/global-state.ts src/components/nav-items.tsx src/components/inbox-view.tsx
git commit -m "feat: inbox display improvements and sidebar badge count"
```

---

### Task 3: Classification badges with icons + colors and pre-classification

**Files:**

- Modify: `src/components/inbox-view.tsx` (badge rendering, auto-classify on mount)

- [ ] **Step 1: Add type badge icon+color mapping**

In `src/components/inbox-view.tsx`, add a helper function and import icons at the top:

```tsx
import { CheckSquare, FileText, FolderOpen, Inbox as InboxIcon, User } from "lucide-react"
```

Add the badge component before `InboxItemCard`:

```tsx
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
```

- [ ] **Step 2: Replace plain text badge with TypeBadge in suggestion area**

In the suggestion display section (inside `InboxItemCard`, the `suggestion` truthy branch), replace:

```tsx
<span className="rounded bg-bg-tertiary px-1.5 py-0.5 text-xs font-medium">
  {suggestion.suggested_type}
</span>
```

With:

```tsx
<TypeBadge type={suggestion.suggested_type} />
```

- [ ] **Step 3: Add pre-classification on mount**

In `InboxItemCard`, add an effect that auto-classifies when the item first renders and is unprocessed:

```tsx
// Auto-classify unprocessed items on mount using heuristics
React.useEffect(() => {
  if (item.frontmatter.status !== "unprocessed") return
  if (suggestion || loading) return

  // Always run heuristic pre-classification (free, instant)
  classifyInboxItem(item.content, "heuristic", "", { people, projects, recentNotes })
    .then((result) => setSuggestion(result))
    .catch(() => {}) // Silently fail — user can still manually classify
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, [item.id])
```

This runs the heuristic classifier immediately (no API key needed). The user can then click "Classify with OpenAI/Claude" to get a better result, which will overwrite the heuristic.

Update the classify button label to indicate re-classification when a suggestion exists:

```tsx
<Button size="small" variant="primary" onClick={classify} disabled={loading}>
  {loading ? (
    <span className="flex items-center gap-1">
      <LoadingIcon16 /> Classifying…
    </span>
  ) : suggestion ? (
    `Re-classify${hasKey ? ` with ${aiProvider === "openai" ? "OpenAI" : "Claude"}` : ""}`
  ) : (
    `Classify${hasKey ? ` with ${aiProvider === "openai" ? "OpenAI" : "Claude"}` : " (heuristic)"}`
  )}
</Button>
```

- [ ] **Step 4: Restructure InboxItemCard to always show suggestion area**

Now that pre-classification runs on mount, the card should always show the suggestion area (initially with heuristic result). Replace the conditional `{suggestion ? (...) : (...)}` with a unified layout:

```tsx
{
  suggestion ? (
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
  )
}
```

- [ ] **Step 5: Add React import for useEffect**

Ensure `React` is imported (it already is via `import React, { ... } from "react"`). Add `useEffect` to the destructured imports if not present. The current import is:

```tsx
import React, { useDeferredValue, useMemo, useState } from "react"
```

Update to:

```tsx
import React, { useEffect, useDeferredValue, useMemo, useState } from "react"
```

Then use `useEffect` instead of `React.useEffect` in the new code, or keep using `React.useEffect` — either is fine, just be consistent with the file.

- [ ] **Step 6: Verify build**

Run: `npm run build`
Expected: No TypeScript errors

- [ ] **Step 7: Commit**

```bash
git add src/components/inbox-view.tsx
git commit -m "feat: classification badges with icons/colors and heuristic pre-classification"
```

---

### Task 4: Task conversion creates checkbox in daily note

**Files:**

- Modify: `src/components/inbox-view.tsx` (enhance `convertToNote` function)

- [ ] **Step 1: Enhance convertToNote to append checkbox to daily note**

In `src/components/inbox-view.tsx`, import `toDateString`:

```tsx
import { toDateString } from "../utils/date"
```

Import `notesAtom` in the existing global-state import:

```tsx
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
```

In `InboxItemCard`, add `notesAtom` read:

```tsx
const notes = useAtomValue(notesAtom)
```

Replace the `convertToNote` function with:

```tsx
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
      // Append to existing daily note
      const content = existingNote.content.trimEnd() + "\n" + checkboxLine + "\n"
      filesToWrite[`${today}.md`] = content
    } else {
      // Create new daily note with the task
      filesToWrite[`${today}.md`] = `# ${today}\n\n${checkboxLine}\n`
    }
  }

  send({
    type: "WRITE_FILES",
    markdownFiles: filesToWrite,
  })
}
```

- [ ] **Step 2: Verify build**

Run: `npm run build`
Expected: No TypeScript errors

- [ ] **Step 3: Commit**

```bash
git add src/components/inbox-view.tsx
git commit -m "feat: task conversion appends checkbox to daily note with wikilink"
```

---

### Task 5: "+ New" buttons for Projects and People views

**Files:**

- Modify: `src/components/projects-view.tsx` (add button + create handler)
- Modify: `src/components/people-view.tsx` (add button + create handler)

- [ ] **Step 1: Add "+ New project" button to ProjectsView**

In `src/components/projects-view.tsx`, add imports:

```tsx
import { useSetAtom } from "jotai"
import { useNavigate } from "@tanstack/react-router"
import { globalStateMachineAtom } from "../global-state"
import { generateNoteId } from "../utils/note-id"
import { Plus } from "lucide-react"
import { Button } from "./button"
```

Remove the now-unused `React` import if it was only used for `useDeferredValue`/`useMemo` — actually keep `React` and add to imports. Update the import line:

```tsx
import React, { useDeferredValue, useMemo } from "react"
```

Inside `ProjectsView`, add the create handler and navigation:

```tsx
const send = useSetAtom(globalStateMachineAtom)
const navigate = useNavigate()

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
```

Add the button next to the search bar. Replace the search+dropdown `<div>` (lines 36-59):

```tsx
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
```

- [ ] **Step 2: Add "+ New person" button to PeopleView**

In `src/components/people-view.tsx`, add the same imports:

```tsx
import { useAtomValue, useSetAtom } from "jotai"
import { useNavigate } from "@tanstack/react-router"
import { globalStateMachineAtom, peopleAtom, tasksAtom } from "../global-state"
import { generateNoteId } from "../utils/note-id"
import { Plus } from "lucide-react"
import { Button } from "./button"
```

Inside `PeopleView`, add the create handler:

```tsx
const send = useSetAtom(globalStateMachineAtom)
const navigate = useNavigate()

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
```

Add the button next to the search bar, same pattern as projects:

```tsx
<div className="flex items-center gap-2">
  <SearchInput
    placeholder={`Search ${filteredPeople.length} people…`}
    value={query}
    onChange={onQueryChange}
  />
  <Button size="small" onClick={createPerson}>
    <Plus size={14} />
    New
  </Button>
  <DropdownMenu>...same dropdown as before...</DropdownMenu>
</div>
```

- [ ] **Step 3: Verify build**

Run: `npm run build`
Expected: No TypeScript errors

- [ ] **Step 4: Commit**

```bash
git add src/components/projects-view.tsx src/components/people-view.tsx
git commit -m "feat: add New button to projects and people views"
```

---

### Task 6: Frontmatter property value autocomplete

**Files:**

- Modify: `src/global-state.ts` (add `frontmatterValuesAtom`)
- Modify: `src/components/note-editor.tsx` (add frontmatter completion function)

- [ ] **Step 1: Add frontmatterValuesAtom to global state**

In `src/global-state.ts`, after the `inboxAtom` and `unprocessedInboxCountAtom`, add:

```ts
// -----------------------------------------------------------------------------
// Frontmatter values (for autocomplete)
// -----------------------------------------------------------------------------

/** Collects all unique values for each frontmatter key across all notes */
export const frontmatterValuesAtom = atom((get) => {
  const notes = get(notesAtom)
  const values: Record<string, Set<string>> = {}

  for (const note of notes.values()) {
    for (const [key, value] of Object.entries(note.frontmatter)) {
      if (typeof value !== "string" || !value) continue
      if (!values[key]) values[key] = new Set()
      values[key].add(value)
    }
  }

  // Convert Sets to sorted arrays
  const result: Record<string, string[]> = {}
  for (const [key, set] of Object.entries(values)) {
    result[key] = [...set].sort()
  }
  return result
})
```

- [ ] **Step 2: Add frontmatter value completion to note-editor**

In `src/components/note-editor.tsx`, import the new atom:

```tsx
import {
  frontmatterValuesAtom,
  isSignedOutAtom,
  peopleAtom,
  projectsAtom,
  tagsAtom,
  templatesAtom,
  vimModeAtom,
} from "../global-state"
```

Add a new completion hook after `useTemplateCompletion` (around line 607):

```tsx
function useFrontmatterValueCompletion() {
  const getValues = useAtomCallback(React.useCallback((get) => get(frontmatterValuesAtom), []))

  const completion = React.useCallback(
    async (context: CompletionContext): Promise<CompletionResult | null> => {
      // Only activate inside frontmatter (between --- markers)
      const doc = context.state.doc.toString()
      const pos = context.pos

      // Find frontmatter boundaries
      if (!doc.startsWith("---\n")) return null
      const endIdx = doc.indexOf("\n---", 4)
      if (endIdx === -1 || pos > endIdx) return null

      // Match "key: value" pattern on current line
      const line = context.state.doc.lineAt(pos)
      const lineText = line.text
      const match = lineText.match(/^(\w[\w-]*): *(.*)$/)
      if (!match) return null

      const key = match[1]
      const valueStart = line.from + lineText.indexOf(": ") + 2
      if (pos < valueStart) return null

      const values = getValues()
      const existing = values[key]
      if (!existing || existing.length === 0) return null

      const typed = match[2]

      return {
        from: valueStart,
        options: existing
          .filter((v) => !typed || v.toLowerCase().includes(typed.toLowerCase()))
          .slice(0, 10)
          .map((v) => ({ label: v })),
        filter: false,
      }
    },
    [getValues],
  )

  return completion
}
```

- [ ] **Step 3: Wire up the completion in the editor**

In the `NoteEditor` component, add the new completion:

```tsx
const frontmatterValueCompletion = useFrontmatterValueCompletion()
```

Add it to the `autocompletion` override array (line 168-176):

```tsx
autocompletion({
  override: [
    dateCompletion,
    frontmatterValueCompletion,
    noteCompletion,
    mentionCompletion,
    tagSyntaxCompletion,
    tagPropertyCompletion,
    templateCompletion,
  ],
  icons: false,
}),
```

Add `frontmatterValueCompletion` to the `useMemo` dependency array (line 209-221).

- [ ] **Step 4: Verify build**

Run: `npm run build`
Expected: No TypeScript errors

- [ ] **Step 5: Commit**

```bash
git add src/global-state.ts src/components/note-editor.tsx
git commit -m "feat: frontmatter property value autocomplete in editor"
```

---

## Parallelization Map

These tasks have no dependencies between them and can be executed by independent subagents:

| Subagent | Tasks                               | Files touched                                        |
| -------- | ----------------------------------- | ---------------------------------------------------- |
| A        | Task 1 (Cmd+Enter)                  | `quick-note.tsx`                                     |
| B        | Task 2 + 3 + 4 (Inbox improvements) | `global-state.ts`, `nav-items.tsx`, `inbox-view.tsx` |
| C        | Task 5 (New buttons)                | `projects-view.tsx`, `people-view.tsx`               |
| D        | Task 6 (Frontmatter autocomplete)   | `global-state.ts`, `note-editor.tsx`                 |

**Note:** Subagents B and D both touch `global-state.ts` but in different sections (B adds `unprocessedInboxCountAtom` after line 913, D adds `frontmatterValuesAtom` after that). The reviewer should verify no conflicts after both complete.

---

## Final verification

After all tasks complete:

```bash
npm run build
npm run format
npm run lint
```
