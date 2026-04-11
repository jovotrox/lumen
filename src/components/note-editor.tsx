import {
  autocompletion,
  Completion,
  CompletionContext,
  CompletionResult,
  startCompletion,
} from "@codemirror/autocomplete"
import { markdown, markdownLanguage } from "@codemirror/lang-markdown"
import { yamlFrontmatter } from "@codemirror/lang-yaml"
import { HighlightStyle, syntaxHighlighting } from "@codemirror/language"
import { EditorSelection, Prec } from "@codemirror/state"
import { EditorView, keymap, ViewUpdate } from "@codemirror/view"
import { createTheme } from "@uiw/codemirror-themes"
import CodeMirror, { ReactCodeMirrorRef } from "@uiw/react-codemirror"
import { parseDate } from "chrono-node"
import { useAtomCallback } from "jotai/utils"
// import * as emoji from "node-emoji"
import { tags } from "@lezer/highlight"
import { vim } from "@replit/codemirror-vim"
import { useNavigate } from "@tanstack/react-router"
import { useAtomValue } from "jotai"
import React from "react"
import { frontmatterExtension } from "../codemirror-extensions/frontmatter"
import { ellipsisExtension } from "../codemirror-extensions/ellipsis"
import { headingExtension } from "../codemirror-extensions/heading"
import { priorityExtension } from "../codemirror-extensions/priority"
import { indentedLineWrapExtension } from "../codemirror-extensions/indented-line-wrap"
import { pasteExtension } from "../codemirror-extensions/paste"
import { spellcheckExtension } from "../codemirror-extensions/spellcheck"
import { wikilinkExtension } from "../codemirror-extensions/wikilink"
import { livePreviewExtension } from "../codemirror-extensions/live-preview"
import { formatKeymapExtension } from "../codemirror-extensions/format-keymap"
import {
  frontmatterValuesAtom,
  isSignedOutAtom,
  peopleAtom,
  projectsAtom,
  tagsAtom,
  templatesAtom,
  vimModeAtom,
} from "../global-state"
import { useAttachFile } from "../hooks/attach-file"
import { useSaveNote } from "../hooks/note"
import { useStableSearchNotes } from "../hooks/search-notes"
import { cx } from "../utils/cx"
import { formatDate, formatDateDistance } from "../utils/date"
import { generateNoteId } from "../utils/note-id"
import { useInsertTemplate } from "./insert-template"

type NoteEditorProps = {
  className?: string
  defaultValue?: string
  placeholder?: string
  minHeight?: number
  editorRef?: React.MutableRefObject<ReactCodeMirrorRef>
  autoFocus?: boolean
  onChange?: (value: string) => void
  onStateChange?: (event: ViewUpdate) => void
  onPaste?: (event: ClipboardEvent, view: EditorView) => void
  onEnter?: () => boolean
  disabled?: boolean
  indentWithTab?: boolean
  /** Enable Obsidian-style live preview (hides syntax on inactive lines) */
  livePreview?: boolean
  /** When set, enables autocomplete for frontmatter values of this specific key (used in property editor) */
  frontmatterKey?: string
}

const theme = createTheme({
  theme: "light",
  settings: {
    background: "transparent",
    lineHighlight: "transparent",
    foreground: "var(--color-text)",
    caret: "var(--color-border-focus)",
    selection: "var(--color-bg-selection)",
    gutterBackground: "transparent",
    gutterForeground: "var(--color-text-secondary)",
    gutterActiveForeground: "var(--color-text-secondary)",
    gutterBorder: "transparent",
  },
  styles: [],
})

const syntaxHighlighter = HighlightStyle.define([
  {
    tag: [tags.comment, tags.contentSeparator],
    color: "var(--color-text-secondary)",
  },
  {
    tag: tags.emphasis,
    fontStyle: "italic",
  },
  {
    tag: tags.strong,
    fontWeight: "var(--font-weight-bold)",
  },
  {
    tag: tags.strikethrough,
    textDecoration: "line-through",
  },
])

export const NoteEditor = React.forwardRef<ReactCodeMirrorRef, NoteEditorProps>(
  (
    {
      className,
      defaultValue = "",
      placeholder = "Write something…",
      minHeight,
      autoFocus = false,
      onChange,
      onStateChange,
      onPaste,
      onEnter,
      disabled = false,
      indentWithTab = true,
      livePreview = false,
      frontmatterKey,
    },
    ref,
  ) => {
    const attachFile = useAttachFile()
    const vimMode = useAtomValue(vimModeAtom)
    const navigate = useNavigate()
    const [isTooltipOpen, setIsTooltipOpen] = React.useState(false)
    const [isCommandKeyPressed, setIsCommandKeyPressed] = React.useState(false)

    // Add global key listeners to track command/ctrl key state
    // This enables visual feedback when users can interact with wikilinks
    React.useEffect(() => {
      function handleKeyDown(event: KeyboardEvent) {
        if (event.metaKey || event.ctrlKey) {
          setIsCommandKeyPressed(true)
        }
      }

      function handleKeyUp(event: KeyboardEvent) {
        if (!event.metaKey && !event.ctrlKey) {
          setIsCommandKeyPressed(false)
        }
      }

      window.addEventListener("keydown", handleKeyDown)
      window.addEventListener("keyup", handleKeyUp)

      // Clean up event listeners on unmount to prevent memory leaks
      return () => {
        window.removeEventListener("keydown", handleKeyDown)
        window.removeEventListener("keyup", handleKeyUp)
      }
    }, [])

    // Completions
    const noteCompletion = useNoteCompletion()
    const mentionCompletion = useMentionCompletion()
    const tagSyntaxCompletion = useTagSyntaxCompletion() // #tag
    const tagPropertyCompletion = useTagPropertyCompletion() // tags: [tag]
    const templateCompletion = useTemplateCompletion()
    const frontmatterValueCompletion = useFrontmatterValueCompletion()
    const propertyValueCompletion = usePropertyValueCompletion(frontmatterKey)

    const extensions = React.useMemo(() => {
      const baseExtensions = [
        // Intercept Enter key before CodeMirror processes it
        Prec.highest(
          keymap.of([
            {
              key: "Enter",
              run: () => onEnter?.() ?? false,
            },
          ]),
        ),
        yamlFrontmatter({ content: markdown({ base: markdownLanguage }) }),
        autocompletion({
          override: frontmatterKey
            ? [propertyValueCompletion]
            : [
                // emojiCompletion,
                dateCompletion,
                frontmatterValueCompletion,
                noteCompletion,
                mentionCompletion,
                tagSyntaxCompletion,
                tagPropertyCompletion,
                templateCompletion,
              ],
          icons: !!frontmatterKey,
          // For property fields, activate immediately on any input
          ...(frontmatterKey ? { activateOnTypingDelay: 0 } : {}),
        }),
        frontmatterExtension(),
        ellipsisExtension(),
        spellcheckExtension(),
        pasteExtension({ attachFile, onPaste }),
        indentedLineWrapExtension(),
        headingExtension(),
        priorityExtension(),
        wikilinkExtension((id) =>
          navigate({
            to: "/notes/$",
            params: { _splat: id },
            search: {
              mode: "read",
              query: undefined,
              view: "grid",
            },
          }),
        ),
        syntaxHighlighting(syntaxHighlighter),
        formatKeymapExtension(),
      ]

      if (vimMode) {
        baseExtensions.push(vim())
      }

      if (livePreview) {
        baseExtensions.push(livePreviewExtension())
      }

      return baseExtensions
    }, [
      attachFile,
      onPaste, // TODO
      onEnter,
      vimMode,
      livePreview,
      frontmatterKey,
      noteCompletion,
      mentionCompletion,
      tagPropertyCompletion,
      tagSyntaxCompletion,
      templateCompletion,
      frontmatterValueCompletion,
      propertyValueCompletion,
      navigate,
    ])

    return (
      <CodeMirror
        ref={ref}
        className={cx(
          "[&_.cm-content]:min-h-[var(--min-height)]",
          className,
          isCommandKeyPressed && "cm-wikilinks-enabled",
        )}
        style={{ "--min-height": `${Math.max(0, minHeight ?? 0)}px` } as React.CSSProperties}
        editable={!disabled}
        placeholder={placeholder}
        value={defaultValue}
        theme={theme}
        indentWithTab={indentWithTab}
        basicSetup={{
          lineNumbers: false,
          foldGutter: false,
          highlightActiveLine: false,
          highlightSelectionMatches: false,
          bracketMatching: false,
        }}
        onCreateEditor={(view) => {
          if (autoFocus) {
            // Focus the editor
            view.focus()
            // Move cursor to end of document
            view.dispatch({
              selection: EditorSelection.cursor(view.state.doc.sliceString(0).length),
            })
          }
          // For property value fields, show autocomplete immediately on focus
          if (frontmatterKey) {
            // Small delay to ensure the editor is fully initialized
            setTimeout(() => startCompletion(view), 0)
          }
        }}
        onUpdate={onStateChange}
        onChange={onChange}
        onKeyDownCapture={(event) => {
          // Command + Enter is reserved for submitting the form so we need to prevent the default behavior
          if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
            event.preventDefault()
          }

          setIsTooltipOpen(Boolean(document.querySelector(".cm-tooltip-autocomplete")))
        }}
        onKeyDown={(event) => {
          // Don't propagate Escape and Enter keydown events to the parent element if autocomplete is open
          if (
            (event.key === "Escape" || event.key === "Enter") &&
            !event.metaKey &&
            !event.ctrlKey &&
            isTooltipOpen
          ) {
            event.stopPropagation()
          }
        }}
        extensions={extensions}
      />
    )
  },
)

function dateCompletion(context: CompletionContext): CompletionResult | null {
  const word = context.matchBefore(/\[\[[^\]|^|]*/)

  if (!word) {
    return null
  }

  // "[[<query>" -> "<query>"
  const query = word.text.replace(/^\[\[/, "")

  if (!query) {
    return null
  }

  const date = parseDate(query)

  if (!date) {
    return null
  }

  const year = String(date.getFullYear()).padStart(4, "0")
  const month = String(date.getMonth() + 1).padStart(2, "0")
  const day = String(date.getDate()).padStart(2, "0")
  const dateString = `${year}-${month}-${day}`

  return {
    from: word.from,
    options: [
      {
        label: formatDate(dateString),
        detail: formatDateDistance(dateString),
        apply: (view, completion, from, to) => {
          const text = `[[${dateString}]]`

          const hasClosingBrackets = view.state.sliceDoc(to, to + 2) === "]]"
          view.dispatch({
            changes: { from, to: hasClosingBrackets ? to + 2 : to, insert: text },
            selection: { anchor: from + text.length },
          })
        },
      },
    ],
    filter: false,
  }
}

/**
 * Autocomplete tags when the user types "#"
 * @example #tag
 */
function useTagSyntaxCompletion() {
  const getTags = useAtomCallback(React.useCallback((get) => get(tagsAtom), []))

  const tagCompletion = React.useCallback(
    async (context: CompletionContext): Promise<CompletionResult | null> => {
      const word = context.matchBefore(/#[\w\-_\d/]*/)

      if (!word) {
        return null
      }

      const tags = Object.entries(getTags())
        // Sort tags by frequency
        .sort((a, b) => b[1].length - a[1].length)
        .map(([name]) => name)

      return {
        from: word.from + 1,
        options: tags
          .filter((tag) => tag.includes(word.text.slice(1)))
          .slice(0, 10)
          .map((name) => ({ label: name })),
        filter: false,
      }
    },
    [getTags],
  )

  return tagCompletion
}

/**
 * Autocomplete tags when using the `tags` property
 * @example tags: [tag]
 */
function useTagPropertyCompletion() {
  const getTags = useAtomCallback(React.useCallback((get) => get(tagsAtom), []))

  const tagCompletion = React.useCallback(
    async (context: CompletionContext): Promise<CompletionResult | null> => {
      const word = context.matchBefore(/tags: +\[[\w-/, ]*/)
      const lastTagMatch = word?.text.match(/[\w-/]+$/)

      if (!word) {
        return null
      }

      const tags = Object.entries(getTags())
        // Sort tags by frequency
        .sort((a, b) => b[1].length - a[1].length)
        .map(([name]) => name)

      return {
        from: word.from + (lastTagMatch?.index ?? word.text.length),
        options: tags
          .filter((tag) => tag.includes(lastTagMatch?.[0] ?? ""))
          .slice(0, 10)
          .map((name) => ({ label: name })),
        filter: false,
      }
    },
    [getTags],
  )

  return tagCompletion
}

function useNoteCompletion() {
  const saveNote = useSaveNote()
  const searchNotes = useStableSearchNotes()
  const isSignedOut = useAtomValue(isSignedOutAtom)

  const noteCompletion = React.useCallback(
    async (context: CompletionContext): Promise<CompletionResult | null> => {
      const word = context.matchBefore(/\[\[[^\]|^|]*/)

      if (!word) {
        return null
      }

      const query = word.text.slice(2)

      const searchResults = searchNotes(query)

      const createNewNoteOption: Completion = {
        label: `Create new note "${query}"`,
        apply: (view, completion, from, to) => {
          const note = {
            id: generateNoteId(),
            content: `# ${query}`,
          }

          saveNote(note)

          // Insert link to new note
          insertWikilink({ view, from, to, noteId: note.id, label: query })
        },
      }

      const typeLabels: Record<string, string> = {
        person: "person",
        project: "project",
        daily: "daily",
        weekly: "weekly",
        template: "template",
      }
      const options = searchResults.slice(0, 10).map((note): Completion => {
        const linkText = note.alias || note.displayName
        return {
          label: note.displayName,
          detail: typeLabels[note.type] ?? undefined,
          apply: (view, completion, from, to) => {
            insertWikilink({ view, from, to, noteId: note.id, label: linkText })
          },
        }
      })

      if (query && !isSignedOut) {
        options.push(createNewNoteOption)
      }

      return {
        from: word.from,
        options,
        filter: false,
      }
    },
    [searchNotes, saveNote, isSignedOut],
  )

  return noteCompletion
}

function useMentionCompletion() {
  const searchNotes = useStableSearchNotes()
  const projects = useAtomValue(projectsAtom)
  const people = useAtomValue(peopleAtom)

  const mentionCompletion = React.useCallback(
    async (context: CompletionContext): Promise<CompletionResult | null> => {
      const word = context.matchBefore(/@[\w-]*/)

      if (!word) return null

      const query = word.text.slice(1) // Remove @ prefix

      // Build grouped options: People first, then Projects, then Notes
      const options: Completion[] = []

      // People matches
      const matchedPeople = people
        .filter(
          (p) =>
            !query ||
            p.displayName.toLowerCase().includes(query.toLowerCase()) ||
            p.id.toLowerCase().includes(query.toLowerCase()),
        )
        .slice(0, 5)

      for (const person of matchedPeople) {
        const linkText = person.alias || person.displayName
        options.push({
          label: person.displayName,
          detail: "person",
          apply: (view, completion, from, to) => {
            insertWikilink({ view, from, to, noteId: person.id, label: linkText })
          },
        })
      }

      // Project matches
      const matchedProjects = projects
        .filter(
          (p) =>
            !query ||
            p.displayName.toLowerCase().includes(query.toLowerCase()) ||
            p.id.toLowerCase().includes(query.toLowerCase()),
        )
        .slice(0, 5)

      for (const project of matchedProjects) {
        const linkText = project.alias || project.displayName
        options.push({
          label: project.displayName,
          detail: "project",
          apply: (view, completion, from, to) => {
            insertWikilink({ view, from, to, noteId: project.id, label: linkText })
          },
        })
      }

      // General note matches (exclude people/projects already shown)
      const shownIds = new Set([
        ...matchedPeople.map((p) => p.id),
        ...matchedProjects.map((p) => p.id),
      ])
      const noteResults = searchNotes(query)
        .filter((n) => !shownIds.has(n.id))
        .slice(0, 5)

      for (const note of noteResults) {
        const linkText = note.alias || note.displayName
        options.push({
          label: note.displayName,
          detail: "note",
          apply: (view, completion, from, to) => {
            insertWikilink({ view, from, to, noteId: note.id, label: linkText })
          },
        })
      }

      if (options.length === 0) return null

      return {
        from: word.from,
        options,
        filter: false,
      }
    },
    [searchNotes, projects, people],
  )

  return mentionCompletion
}

type InsertWikilinkParams = {
  view: EditorView
  from: number
  to: number
  noteId: string
  label: string
}

function insertWikilink({ view, from, to, noteId, label }: InsertWikilinkParams) {
  const text = `[[${noteId}|${label}]]`

  const hasClosingBrackets = view.state.sliceDoc(to, to + 2) === "]]"

  view.dispatch({
    changes: { from, to: hasClosingBrackets ? to + 2 : to, insert: text },
    selection: { anchor: from + text.length },
  })
}

function useTemplateCompletion() {
  const getTemplates = useAtomCallback(React.useCallback((get) => get(templatesAtom), []))
  const insertTemplate = useInsertTemplate()

  const tagCompletion = React.useCallback(
    async (context: CompletionContext): Promise<CompletionResult | null> => {
      const query = context.matchBefore(/\/.*/)

      if (!query) {
        return null
      }

      const templates = Object.values(getTemplates())

      return {
        from: query.from + 1,
        options: templates.map((template) => ({
          label: template.name,
          apply: (view, completion, from, to) => {
            // Remove "/<query>" from editor
            view.dispatch({
              changes: { from: from - 1, to, insert: "" },
            })

            insertTemplate(template, view)
          },
        })),
      }
    },
    [getTemplates, insertTemplate],
  )

  return tagCompletion
}

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

/** Date suggestions for date-type frontmatter keys (deadline, due, etc.) */
function getDateSuggestions(context: CompletionContext): CompletionResult {
  const typed = context.state.doc.toString()
  const today = new Date()
  const fmt = (d: Date) => {
    const y = d.getFullYear()
    const m = String(d.getMonth() + 1).padStart(2, "0")
    const day = String(d.getDate()).padStart(2, "0")
    return `${y}-${m}-${day}`
  }
  const addDays = (d: Date, n: number) => {
    const r = new Date(d)
    r.setDate(r.getDate() + n)
    return r
  }
  const nextWeekday = (d: Date, dow: number) => {
    const r = new Date(d)
    const diff = (dow - r.getDay() + 7) % 7 || 7
    r.setDate(r.getDate() + diff)
    return r
  }

  const suggestions: { label: string; detail: string }[] = [
    { label: fmt(today), detail: "Today" },
    { label: fmt(addDays(today, 1)), detail: "Tomorrow" },
    { label: fmt(nextWeekday(today, 1)), detail: "Next Monday" },
    { label: fmt(nextWeekday(today, 5)), detail: "Next Friday" },
    { label: fmt(addDays(today, 7)), detail: "In 1 week" },
    { label: fmt(addDays(today, 14)), detail: "In 2 weeks" },
    { label: fmt(addDays(today, 30)), detail: "In 1 month" },
  ]

  // If user typed something, also try chrono parse
  if (typed.trim()) {
    const parsed = parseDate(typed)
    if (parsed) {
      const parsedStr = fmt(parsed)
      if (!suggestions.some((s) => s.label === parsedStr)) {
        suggestions.unshift({ label: parsedStr, detail: `"${typed}"` })
      }
    }
  }

  return {
    from: 0,
    options: suggestions
      .filter(
        (s) =>
          !typed || s.label.includes(typed) || s.detail.toLowerCase().includes(typed.toLowerCase()),
      )
      .slice(0, 8)
      .map((s) => ({ label: s.label, detail: s.detail })),
    filter: false,
  }
}

/** Predefined values for known frontmatter keys */
type KnownValue = { value: string; detail?: string; color?: string }
const knownPropertyValues: Record<string, KnownValue[]> = {
  status: [
    { value: "active", detail: "active", color: "var(--color-text-success)" },
    { value: "paused", detail: "paused", color: "var(--color-text-pending)" },
    { value: "completed", detail: "done", color: "var(--color-text-secondary)" },
    { value: "cancelled", detail: "ended", color: "var(--color-text-danger)" },
  ],
  priority: [
    { value: "1", detail: "highest", color: "var(--color-text-danger)" },
    { value: "2", detail: "medium", color: "var(--color-text-pending)" },
    { value: "3", detail: "low", color: "var(--color-border-focus)" },
  ],
  type: [
    { value: "project", detail: "project" },
    { value: "person", detail: "person" },
    { value: "inbox", detail: "inbox" },
    { value: "note", detail: "note" },
    { value: "task", detail: "task" },
  ],
}

/** Map known values to a CSS type class for icon rendering */
const statusColorType: Record<string, string> = {
  active: "cm-s-active",
  paused: "cm-s-paused",
  completed: "cm-s-completed",
  cancelled: "cm-s-cancelled",
  "1": "cm-s-p1",
  "2": "cm-s-p2",
  "3": "cm-s-p3",
  project: "cm-s-project",
  person: "cm-s-person",
  inbox: "cm-s-inbox",
  note: "cm-s-note",
  task: "cm-s-task",
  daily: "cm-s-note",
  weekly: "cm-s-note",
  template: "cm-s-note",
}

/** Completion for property value fields in the Properties panel (read mode) */
function usePropertyValueCompletion(frontmatterKey?: string) {
  const getValues = useAtomCallback(React.useCallback((get) => get(frontmatterValuesAtom), []))

  const completion = React.useCallback(
    async (context: CompletionContext): Promise<CompletionResult | null> => {
      if (!frontmatterKey) return null

      // Allow activation on explicit trigger (startCompletion) or any typing
      if (!context.explicit && !context.matchBefore(/.*/)) return null

      // Date keys get date suggestions
      const dateKeys = ["deadline", "due", "date", "due_date", "start_date", "end_date"]
      if (dateKeys.includes(frontmatterKey)) {
        return getDateSuggestions(context)
      }

      const values = getValues()
      const existing = values[frontmatterKey] ?? []
      const known = knownPropertyValues[frontmatterKey] ?? []

      // Merge known values with dynamic ones, known first, then unique dynamic
      const knownValues = new Set(known.map((k) => k.value))
      const knownMap = new Map(known.map((k) => [k.value, k.detail]))

      const allOptions: Completion[] = []

      // Add known values first (with type class for color)
      for (const k of known) {
        allOptions.push({
          label: k.value,
          detail: k.detail,
          type: statusColorType[k.value],
        })
      }

      // Add dynamic values not already in known set (skip invalid values)
      for (const v of existing) {
        if (!knownValues.has(v) && v !== "undefined" && v !== "null" && v !== "converted") {
          allOptions.push({
            label: v,
            detail: knownMap.get(v),
            type: statusColorType[v],
          })
        }
      }

      if (allOptions.length === 0) return null

      const typed = context.state.doc.toString()

      return {
        from: 0,
        options: allOptions
          .filter((o) => !typed || o.label.toLowerCase().includes(typed.toLowerCase()))
          .slice(0, 10),
        filter: false,
      }
    },
    [getValues, frontmatterKey],
  )

  return completion
}

// function emojiCompletion(context: CompletionContext): CompletionResult | null {
//   const word = context.matchBefore(/(^:\w*|\s:\w*)/)

//   if (!word) {
//     return null
//   }

//   // ":<query>" -> "<query>"
//   const query = word.text.replace(/^(\s*)?:/, "")

//   const results = emoji.search(query)

//   const start = word.from + word.text.indexOf(":")

//   return {
//     from: start,
//     options: results.slice(0, 10).map((result) => ({
//       label: `${result.emoji} ${result.name}`,
//       apply: result.emoji,
//     })),
//     filter: false,
//   }
// }
