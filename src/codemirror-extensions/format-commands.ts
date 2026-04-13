import { EditorState } from "@codemirror/state"
import { EditorView } from "@codemirror/view"

// ---------------------------------------------------------------------------
// Inline helpers
// ---------------------------------------------------------------------------

/**
 * Generic inline toggle: wraps/unwraps the current selection with `marker`.
 * If there is no selection, inserts the marker pair and places the cursor
 * between them.
 *
 * @param extraGuard - Optional function that, given the doc string and the
 *   selection range, returns true when the selection should be treated as
 *   already wrapped. Used by toggleItalic to avoid false-positives with bold.
 */
function toggleInlineMarker(
  view: EditorView,
  marker: string,
  extraGuard?: (doc: string, from: number, to: number) => boolean,
): boolean {
  const { state } = view
  const { from, to } = state.selection.main
  const markerLen = marker.length

  if (from === to) {
    // No selection – insert marker pair and place cursor between them
    view.dispatch({
      changes: { from, to, insert: marker + marker },
      selection: { anchor: from + markerLen },
      scrollIntoView: true,
    })
    return true
  }

  // Check whether the selection is already wrapped
  const beforeStart = from - markerLen
  const afterEnd = to + markerLen

  const before = beforeStart >= 0 ? state.doc.sliceString(beforeStart, from) : ""
  const after = afterEnd <= state.doc.length ? state.doc.sliceString(to, afterEnd) : ""

  const basicWrapped = before === marker && after === marker
  const alreadyWrapped = basicWrapped && (!extraGuard || extraGuard(state.doc.toString(), from, to))

  if (alreadyWrapped) {
    // Remove markers, keep same text selected
    view.dispatch({
      changes: [
        { from: beforeStart, to: from, insert: "" },
        { from: to, to: afterEnd, insert: "" },
      ],
      selection: {
        anchor: beforeStart,
        head: to - markerLen,
      },
      scrollIntoView: true,
    })
  } else {
    // Add markers around selection, keep same text selected
    view.dispatch({
      changes: [
        { from, insert: marker },
        { from: to, insert: marker },
      ],
      selection: {
        anchor: from + markerLen,
        head: to + markerLen,
      },
      scrollIntoView: true,
    })
  }

  return true
}

/**
 * Check whether the current selection is wrapped with the given marker.
 * Accepts an optional guard function (same signature as toggleInlineMarker)
 * to refine the detection – used by isItalicActive to avoid bold false-positives.
 */
function isInlineMarkerActive(
  state: EditorState,
  marker: string,
  extraGuard?: (doc: string, from: number, to: number) => boolean,
): boolean {
  const { from, to } = state.selection.main
  if (from === to) return false

  const markerLen = marker.length
  const beforeStart = from - markerLen
  const afterEnd = to + markerLen

  if (beforeStart < 0 || afterEnd > state.doc.length) return false

  const before = state.doc.sliceString(beforeStart, from)
  const after = state.doc.sliceString(to, afterEnd)

  if (before !== marker || after !== marker) return false

  if (extraGuard && !extraGuard(state.doc.toString(), from, to)) return false

  return true
}

// ---------------------------------------------------------------------------
// Italic guard: adjacent character must NOT also be `*` (would be bold)
// ---------------------------------------------------------------------------

function italicGuard(doc: string, from: number, to: number): boolean {
  const markerLen = 1
  const beforeStart = from - markerLen
  const afterEnd = to + markerLen

  const charBeforeMarker = beforeStart > 0 ? doc[beforeStart - 1] : ""
  const charAfterMarker = afterEnd < doc.length ? doc[afterEnd] : ""

  return charBeforeMarker !== "*" && charAfterMarker !== "*"
}

// ---------------------------------------------------------------------------
// Inline format commands
// ---------------------------------------------------------------------------

export function toggleBold(view: EditorView): boolean {
  return toggleInlineMarker(view, "**")
}

export function toggleItalic(view: EditorView): boolean {
  return toggleInlineMarker(view, "*", italicGuard)
}

export function toggleStrikethrough(view: EditorView): boolean {
  return toggleInlineMarker(view, "~~")
}

export function toggleInlineCode(view: EditorView): boolean {
  return toggleInlineMarker(view, "`")
}

// ---------------------------------------------------------------------------
// Inline detection helpers
// ---------------------------------------------------------------------------

export function isBoldActive(state: EditorState): boolean {
  return isInlineMarkerActive(state, "**")
}

export function isItalicActive(state: EditorState): boolean {
  return isInlineMarkerActive(state, "*", italicGuard)
}

export function isStrikethroughActive(state: EditorState): boolean {
  return isInlineMarkerActive(state, "~~")
}

export function isInlineCodeActive(state: EditorState): boolean {
  return isInlineMarkerActive(state, "`")
}

// ---------------------------------------------------------------------------
// Block helpers
// ---------------------------------------------------------------------------

interface LineRange {
  firstLine: number
  lastLine: number
}

function getSelectionLineRange(view: EditorView): LineRange {
  const { from, to } = view.state.selection.main
  const firstLine = view.state.doc.lineAt(from).number
  const lastLine = view.state.doc.lineAt(to).number
  return { firstLine, lastLine }
}

/**
 * Generic line-prefix toggle.
 * - If ALL selected lines start with `prefix`, remove it from all.
 * - Otherwise, add it to every line that doesn't already have it.
 */
function toggleLinePrefix(view: EditorView, prefix: string): boolean {
  const { state } = view
  const { from, to } = state.selection.main
  const { firstLine, lastLine } = getSelectionLineRange(view)

  const lines = []
  for (let i = firstLine; i <= lastLine; i++) {
    lines.push(state.doc.line(i))
  }

  const allHavePrefix = lines.every((l) => l.text.startsWith(prefix))

  const changes: { from: number; to?: number; insert: string }[] = []

  let selectionDelta = 0
  let firstChangeDelta = 0

  if (allHavePrefix) {
    // Remove prefix from every line
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]
      changes.push({ from: line.from, to: line.from + prefix.length, insert: "" })
      if (i === 0) firstChangeDelta = -prefix.length
    }
    selectionDelta = -prefix.length
  } else {
    // Add prefix to lines that don't have it
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]
      if (!line.text.startsWith(prefix)) {
        changes.push({ from: line.from, insert: prefix })
        if (i === 0) firstChangeDelta = prefix.length
      }
    }
    selectionDelta = prefix.length
  }

  if (changes.length === 0) return true

  // Adjust selection anchors
  // Fix: use changes.length instead of (lastLine - firstLine + 1) so that
  // lines that already had the prefix are not double-counted.
  const newAnchor = Math.max(0, from + firstChangeDelta)
  const changeCount = changes.length
  const newHead = from === to ? newAnchor : Math.max(0, to + selectionDelta * changeCount)

  view.dispatch({
    changes,
    selection: { anchor: newAnchor, head: newHead },
    scrollIntoView: true,
  })

  return true
}

// ---------------------------------------------------------------------------
// Block format commands
// ---------------------------------------------------------------------------

export function setHeading(view: EditorView, level: 1 | 2 | 3): boolean {
  const { state } = view
  const { from } = state.selection.main
  const line = state.doc.lineAt(from)

  const newPrefix = "#".repeat(level) + " "
  const headingMatch = line.text.match(/^(#{1,6}) /)

  if (headingMatch) {
    const existingPrefix = headingMatch[0] // e.g. "## "
    if (existingPrefix === newPrefix) {
      // Same heading level – remove it
      const delta = -existingPrefix.length
      view.dispatch({
        changes: { from: line.from, to: line.from + existingPrefix.length, insert: "" },
        selection: { anchor: Math.max(line.from, from + delta) },
        scrollIntoView: true,
      })
    } else {
      // Different heading level – replace
      const delta = newPrefix.length - existingPrefix.length
      view.dispatch({
        changes: { from: line.from, to: line.from + existingPrefix.length, insert: newPrefix },
        selection: { anchor: Math.max(line.from, from + delta) },
        scrollIntoView: true,
      })
    }
  } else {
    // No heading – add it
    view.dispatch({
      changes: { from: line.from, insert: newPrefix },
      selection: { anchor: from + newPrefix.length },
      scrollIntoView: true,
    })
  }

  return true
}

export function toggleBlockquote(view: EditorView): boolean {
  return toggleLinePrefix(view, "> ")
}

export function toggleCodeBlock(view: EditorView): boolean {
  const { state } = view
  const { from, to } = state.selection.main
  const selectedText = state.doc.sliceString(from, to)

  // Check if already wrapped in triple-backtick fences
  const fence = "```"
  const fenceNewline = "```\n"
  const newlineFence = "\n```"

  const beforeFence =
    from >= fenceNewline.length ? state.doc.sliceString(from - fenceNewline.length, from) : ""
  const afterFence =
    to + newlineFence.length <= state.doc.length
      ? state.doc.sliceString(to, to + newlineFence.length)
      : ""

  if (beforeFence === fenceNewline && afterFence === newlineFence) {
    // Remove fences
    const outerFrom = from - fenceNewline.length
    const outerTo = to + newlineFence.length
    view.dispatch({
      changes: { from: outerFrom, to: outerTo, insert: selectedText },
      selection: { anchor: outerFrom, head: outerFrom + selectedText.length },
      scrollIntoView: true,
    })
  } else {
    // Check if cursor is mid-line; if so, prepend a newline before the fence
    const needsLeadingNewline = from > 0 && state.doc.lineAt(from).from !== from
    const leadingNewline = needsLeadingNewline ? "\n" : ""

    const insert = leadingNewline + fence + "\n" + selectedText + "\n" + fence
    const fenceStart = from + leadingNewline.length
    view.dispatch({
      changes: { from, to, insert },
      selection: {
        anchor: fenceStart + fence.length + 1,
        head: fenceStart + fence.length + 1 + selectedText.length,
      },
      scrollIntoView: true,
    })
  }

  return true
}

// Matches any list marker at line start. Order matters: task must be checked
// before the plain bullet, since "- [ ] " starts with "- " too.
const LIST_MARKER_REGEX = /^(- \[[ xX]\] |- |\d+\. )/

type ListKind = "bullet" | "numbered" | "task"

function kindOfMarker(marker: string): ListKind {
  if (/^- \[[ xX]\] /.test(marker)) return "task"
  if (marker === "- ") return "bullet"
  return "numbered"
}

/**
 * Replace or remove list markers on the selected lines.
 * - If ALL selected lines already have the target kind → remove markers (toggle off).
 * - Otherwise, strip any existing list marker on each line and apply the target kind.
 * For numbered lists, numbering is renumbered starting at 1 on the first affected line.
 */
function setListKind(view: EditorView, kind: ListKind): boolean {
  const { state } = view
  const { from, to } = state.selection.main
  const { firstLine, lastLine } = getSelectionLineRange(view)

  const lines = []
  for (let i = firstLine; i <= lastLine; i++) {
    lines.push(state.doc.line(i))
  }

  const markers = lines.map((l) => {
    const m = l.text.match(LIST_MARKER_REGEX)
    return m ? m[0] : null
  })

  const allMatchKind = markers.every((m) => m !== null && kindOfMarker(m) === kind)

  const changes: { from: number; to?: number; insert: string }[] = []
  let firstChangeDelta = 0
  let totalDelta = 0
  let counter = 1

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    const existing = markers[i]
    const existingLen = existing?.length ?? 0

    let newPrefix: string
    if (allMatchKind) {
      // Toggle off
      newPrefix = ""
    } else if (kind === "bullet") {
      newPrefix = "- "
    } else if (kind === "task") {
      // Preserve checkbox state if the user was already on a task line of the same kind;
      // otherwise default to unchecked.
      newPrefix = existing && /^- \[[xX]\] /.test(existing) ? existing : "- [ ] "
    } else {
      // numbered — renumber from 1
      newPrefix = `${counter}. `
      counter++
    }

    if (existing === newPrefix) continue

    const lineDelta = newPrefix.length - existingLen
    if (i === 0) firstChangeDelta = lineDelta
    totalDelta += lineDelta

    if (existingLen > 0) {
      changes.push({ from: line.from, to: line.from + existingLen, insert: newPrefix })
    } else {
      changes.push({ from: line.from, insert: newPrefix })
    }
  }

  if (changes.length === 0) return true

  const newAnchor = Math.max(0, from + firstChangeDelta)
  const newHead = from === to ? newAnchor : Math.max(0, to + totalDelta)

  view.dispatch({
    changes,
    selection: { anchor: newAnchor, head: newHead },
    scrollIntoView: true,
  })

  return true
}

export function toggleBulletList(view: EditorView): boolean {
  return setListKind(view, "bullet")
}

export function toggleNumberedList(view: EditorView): boolean {
  return setListKind(view, "numbered")
}

export function toggleTaskList(view: EditorView): boolean {
  return setListKind(view, "task")
}

// ---------------------------------------------------------------------------
// Block detection helpers
// ---------------------------------------------------------------------------

export function getHeadingLevel(state: EditorState): number {
  const { from } = state.selection.main
  const line = state.doc.lineAt(from)
  const match = line.text.match(/^(#{1,6}) /)
  if (!match) return 0
  return match[1].length
}

export function isBlockquoteActive(state: EditorState): boolean {
  const { from } = state.selection.main
  return state.doc.lineAt(from).text.startsWith("> ")
}

export function isBulletListActive(state: EditorState): boolean {
  const { from } = state.selection.main
  const text = state.doc.lineAt(from).text
  return (
    text.startsWith("- ") &&
    !text.startsWith("- [ ] ") &&
    !text.startsWith("- [x] ") &&
    !text.startsWith("- [X] ")
  )
}

export function isNumberedListActive(state: EditorState): boolean {
  const { from } = state.selection.main
  return /^\d+\. /.test(state.doc.lineAt(from).text)
}

export function isTaskListActive(state: EditorState): boolean {
  const { from } = state.selection.main
  const text = state.doc.lineAt(from).text
  return text.startsWith("- [ ] ") || text.startsWith("- [x] ") || text.startsWith("- [X] ")
}

// ---------------------------------------------------------------------------
// Link commands
// ---------------------------------------------------------------------------

export function insertLink(view: EditorView): boolean {
  const { state } = view
  const { from, to } = state.selection.main
  const selectedText = state.doc.sliceString(from, to)
  const urlPlaceholder = "url"

  if (selectedText) {
    const insert = `[${selectedText}](${urlPlaceholder})`
    // Cursor selects the "url" placeholder
    const urlStart = from + 1 + selectedText.length + 2
    view.dispatch({
      changes: { from, to, insert },
      selection: {
        anchor: urlStart,
        head: urlStart + urlPlaceholder.length,
      },
      scrollIntoView: true,
    })
  } else {
    const insert = `[](${urlPlaceholder})`
    const urlStart = from + 3
    view.dispatch({
      changes: { from, insert },
      selection: {
        anchor: urlStart,
        head: urlStart + urlPlaceholder.length,
      },
      scrollIntoView: true,
    })
  }

  return true
}

export function insertWikilink(view: EditorView): boolean {
  const { state } = view
  const { from, to } = state.selection.main
  const selectedText = state.doc.sliceString(from, to)

  if (selectedText) {
    const insert = `[[${selectedText}]]`
    // Cursor at end, inside the closing brackets
    const cursorPos = from + insert.length - 2
    view.dispatch({
      changes: { from, to, insert },
      selection: { anchor: cursorPos },
      scrollIntoView: true,
    })
  } else {
    const insert = `[[]]`
    view.dispatch({
      changes: { from, insert },
      selection: { anchor: from + 2 },
      scrollIntoView: true,
    })
  }

  return true
}
