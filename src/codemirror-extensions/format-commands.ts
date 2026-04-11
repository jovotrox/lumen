import { EditorState } from "@codemirror/state"
import { EditorView } from "@codemirror/view"

// ---------------------------------------------------------------------------
// Inline helpers
// ---------------------------------------------------------------------------

/**
 * Generic inline toggle: wraps/unwraps the current selection with `marker`.
 * If there is no selection, inserts the marker pair and places the cursor
 * between them.
 */
function toggleInlineMarker(view: EditorView, marker: string): boolean {
  const { state } = view
  const { from, to } = state.selection.main
  const markerLen = marker.length

  if (from === to) {
    // No selection – insert marker pair and place cursor between them
    view.dispatch({
      changes: { from, to, insert: marker + marker },
      selection: { anchor: from + markerLen },
    })
    return true
  }

  // Check whether the selection is already wrapped
  const beforeStart = from - markerLen
  const afterEnd = to + markerLen

  const before = beforeStart >= 0 ? state.doc.sliceString(beforeStart, from) : ""
  const after = afterEnd <= state.doc.length ? state.doc.sliceString(to, afterEnd) : ""

  const alreadyWrapped = before === marker && after === marker

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
    })
  }

  return true
}

/**
 * Check whether the current selection is wrapped with the given marker.
 * Special-cases italic (`*`) to avoid false positives with bold (`**`).
 */
function isInlineMarkerActive(state: EditorState, marker: string): boolean {
  const { from, to } = state.selection.main
  if (from === to) return false

  const markerLen = marker.length
  const beforeStart = from - markerLen
  const afterEnd = to + markerLen

  if (beforeStart < 0 || afterEnd > state.doc.length) return false

  const before = state.doc.sliceString(beforeStart, from)
  const after = state.doc.sliceString(to, afterEnd)

  if (before !== marker || after !== marker) return false

  // Extra guard for italic (`*`): the adjacent character must NOT also be `*`
  if (marker === "*") {
    const charBeforeMarker =
      beforeStart > 0 ? state.doc.sliceString(beforeStart - 1, beforeStart) : ""
    const charAfterMarker =
      afterEnd < state.doc.length ? state.doc.sliceString(afterEnd, afterEnd + 1) : ""
    if (charBeforeMarker === "*" || charAfterMarker === "*") return false
  }

  return true
}

// ---------------------------------------------------------------------------
// Inline format commands
// ---------------------------------------------------------------------------

export function toggleBold(view: EditorView): boolean {
  return toggleInlineMarker(view, "**")
}

export function toggleItalic(view: EditorView): boolean {
  const { state } = view
  const { from, to } = state.selection.main
  const marker = "*"
  const markerLen = 1

  if (from === to) {
    view.dispatch({
      changes: { from, to, insert: marker + marker },
      selection: { anchor: from + markerLen },
    })
    return true
  }

  const beforeStart = from - markerLen
  const afterEnd = to + markerLen

  const before = beforeStart >= 0 ? state.doc.sliceString(beforeStart, from) : ""
  const after = afterEnd <= state.doc.length ? state.doc.sliceString(to, afterEnd) : ""

  // Verify we have `*` but not `**`
  const charBefore2 = beforeStart > 0 ? state.doc.sliceString(beforeStart - 1, beforeStart) : ""
  const charAfter2 =
    afterEnd < state.doc.length ? state.doc.sliceString(afterEnd, afterEnd + 1) : ""

  const alreadyWrapped =
    before === marker && after === marker && charBefore2 !== "*" && charAfter2 !== "*"

  if (alreadyWrapped) {
    view.dispatch({
      changes: [
        { from: beforeStart, to: from, insert: "" },
        { from: to, to: afterEnd, insert: "" },
      ],
      selection: { anchor: beforeStart, head: to - markerLen },
    })
  } else {
    view.dispatch({
      changes: [
        { from, insert: marker },
        { from: to, insert: marker },
      ],
      selection: { anchor: from + markerLen, head: to + markerLen },
    })
  }

  return true
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
  const { from, to } = state.selection.main
  if (from === to) return false

  const markerLen = 1
  const beforeStart = from - markerLen
  const afterEnd = to + markerLen

  if (beforeStart < 0 || afterEnd > state.doc.length) return false

  const before = state.doc.sliceString(beforeStart, from)
  const after = state.doc.sliceString(to, afterEnd)

  if (before !== "*" || after !== "*") return false

  // Must not be bold (`**`)
  const charBefore2 = beforeStart > 0 ? state.doc.sliceString(beforeStart - 1, beforeStart) : ""
  const charAfter2 =
    afterEnd < state.doc.length ? state.doc.sliceString(afterEnd, afterEnd + 1) : ""

  return charBefore2 !== "*" && charAfter2 !== "*"
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
  const newAnchor = Math.max(0, from + firstChangeDelta)
  const newHead =
    from === to ? newAnchor : Math.max(0, to + selectionDelta * (lastLine - firstLine + 1))

  view.dispatch({
    changes,
    selection: { anchor: newAnchor, head: newHead },
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
      })
    } else {
      // Different heading level – replace
      const delta = newPrefix.length - existingPrefix.length
      view.dispatch({
        changes: { from: line.from, to: line.from + existingPrefix.length, insert: newPrefix },
        selection: { anchor: Math.max(line.from, from + delta) },
      })
    }
  } else {
    // No heading – add it
    view.dispatch({
      changes: { from: line.from, insert: newPrefix },
      selection: { anchor: from + newPrefix.length },
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
    })
  } else {
    // Add fences
    const insert = fence + "\n" + selectedText + "\n" + fence
    view.dispatch({
      changes: { from, to, insert },
      selection: {
        anchor: from + fence.length + 1,
        head: from + fence.length + 1 + selectedText.length,
      },
    })
  }

  return true
}

export function toggleBulletList(view: EditorView): boolean {
  return toggleLinePrefix(view, "- ")
}

export function toggleNumberedList(view: EditorView): boolean {
  const { state } = view
  const { from, to } = state.selection.main
  const { firstLine, lastLine } = getSelectionLineRange(view)

  const numberedRegex = /^\d+\. /

  const lines = []
  for (let i = firstLine; i <= lastLine; i++) {
    lines.push(state.doc.line(i))
  }

  const allHavePrefix = lines.every((l) => numberedRegex.test(l.text))

  const changes: { from: number; to?: number; insert: string }[] = []

  if (allHavePrefix) {
    // Remove numbered prefix from every line
    for (const line of lines) {
      const match = line.text.match(/^\d+\. /)
      if (match) {
        changes.push({ from: line.from, to: line.from + match[0].length, insert: "" })
      }
    }
  } else {
    // Add numbered prefix; auto-increment counter
    let counter = 1
    for (const line of lines) {
      if (!numberedRegex.test(line.text)) {
        changes.push({ from: line.from, insert: `${counter}. ` })
      }
      counter++
    }
  }

  if (changes.length === 0) return true

  // Simple selection adjustment: move anchor by the first change delta
  const firstChange = changes[0]
  const firstDelta = allHavePrefix
    ? -(lines[0].text.match(/^\d+\. /)?.[0].length ?? 0)
    : (firstChange.insert?.length ?? 0)

  const newAnchor = Math.max(0, from + firstDelta)

  view.dispatch({
    changes,
    selection: { anchor: newAnchor, head: from === to ? newAnchor : Math.max(0, to) },
  })

  return true
}

export function toggleTaskList(view: EditorView): boolean {
  return toggleLinePrefix(view, "- [ ] ")
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
  return state.doc.lineAt(from).text.startsWith("- ")
}

export function isNumberedListActive(state: EditorState): boolean {
  const { from } = state.selection.main
  return /^\d+\. /.test(state.doc.lineAt(from).text)
}

export function isTaskListActive(state: EditorState): boolean {
  const { from } = state.selection.main
  const text = state.doc.lineAt(from).text
  return text.startsWith("- [ ] ") || text.startsWith("- [x] ")
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
    })
  } else {
    const insert = `[[]]`
    view.dispatch({
      changes: { from, insert },
      selection: { anchor: from + 2 },
    })
  }

  return true
}
