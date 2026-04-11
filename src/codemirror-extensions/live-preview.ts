import { EditorState, Extension, Range, StateField } from "@codemirror/state"
import { Decoration, DecorationSet, EditorView, keymap, WidgetType } from "@codemirror/view"

/**
 * Live Preview Extension for CodeMirror
 *
 * Provides WYSIWYG-style live preview where markdown syntax is always hidden
 * and formatting is always rendered visually. The underlying document is still
 * markdown — use the format toolbar or keyboard shortcuts to change formatting.
 *
 * Features: Headers, Bold, Italic, Strikethrough, Inline Code, Blockquotes, Task Lists
 */

// Regex patterns for markdown syntax
const HEADER_REGEX = /^(#{1,6})\s+(.*)$/
// Matches: "- [ ]", "- [x]" with optional leading whitespace
const TASK_REGEX = /^(\s*)-\s+\[([ xX])\]\s*/
const BOLD_REGEX = /\*\*([^*]+)\*\*/g
const ITALIC_STAR_REGEX = /(?<!\*)\*([^*]+)\*(?!\*)/g
const ITALIC_UNDERSCORE_REGEX = /(?<!_)_([^_]+)_(?!_)/g
const STRIKETHROUGH_REGEX = /~~([^~]+)~~/g
const INLINE_CODE_REGEX = /(?<!`)(`[^`]+`)(?!`)/g
const BLOCKQUOTE_REGEX = /^>\s?/
// Matches bullet list: "- text" or "* text" (but NOT "- [ ]" tasks)
const BULLET_LIST_REGEX = /^(\s*)[-*]\s(?!\[[ xX]\])/

// Widget to render nothing (hides syntax markers)
class HiddenWidget extends WidgetType {
  toDOM() {
    const span = document.createElement("span")
    span.style.display = "none"
    return span
  }
}

// Widget for bullet point — matches view mode: 6px circle inside 28px container
class BulletWidget extends WidgetType {
  toDOM() {
    const container = document.createElement("span")
    container.className = "cm-live-bullet-container"
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg")
    svg.setAttribute("width", "6")
    svg.setAttribute("height", "6")
    svg.setAttribute("viewBox", "0 0 6 6")
    svg.setAttribute("fill", "currentColor")
    const circle = document.createElementNS("http://www.w3.org/2000/svg", "circle")
    circle.setAttribute("cx", "3")
    circle.setAttribute("cy", "3")
    circle.setAttribute("r", "3")
    svg.appendChild(circle)
    container.appendChild(svg)
    return container
  }
}

// Widget for checkbox — matches view mode: 16px checkbox inside 28px container
class CheckboxWidget extends WidgetType {
  constructor(private checked: boolean) {
    super()
  }

  toDOM() {
    const container = document.createElement("span")
    container.className = "cm-live-checkbox-container"

    const checkbox = document.createElement("span")
    checkbox.className = `cm-live-checkbox ${this.checked ? "cm-live-checkbox-checked" : ""}`
    checkbox.textContent = this.checked ? "✓" : ""
    container.appendChild(checkbox)

    return container
  }
}

function createLivePreviewField() {
  return StateField.define<DecorationSet>({
    create(state) {
      return createDecorations(state)
    },
    update(decorations, tr) {
      if (tr.docChanged || tr.selection) {
        return createDecorations(tr.state)
      }
      return decorations
    },
    provide: (f) => EditorView.decorations.from(f),
  })
}

function createDecorations(state: EditorState): DecorationSet {
  const decorations: Range<Decoration>[] = []

  // Track the active line(s) — we apply Decoration.mark() everywhere (styling)
  // but only apply Decoration.replace() (hiding markers) on INACTIVE lines.
  // This prevents cursor positioning issues from widget replacements.
  const cursorFrom = state.selection.main.from
  const cursorTo = state.selection.main.to
  const cursorStartLine = state.doc.lineAt(cursorFrom).number
  const cursorEndLine = state.doc.lineAt(cursorTo).number

  for (let i = 1; i <= state.doc.lines; i++) {
    const line = state.doc.line(i)
    const isActiveLine = i >= cursorStartLine && i <= cursorEndLine

    // Process headers
    const headerMatch = line.text.match(HEADER_REGEX)
    if (headerMatch) {
      const [_fullMatch, hashes, content] = headerMatch
      const level = hashes.length
      const hashesEnd = line.from + hashes.length + 1 // +1 for space

      if (!isActiveLine) {
        // Hide the "# " part on inactive lines
        decorations.push(
          Decoration.replace({ widget: new HiddenWidget() }).range(line.from, hashesEnd),
        )
      } else {
        // Dim the "# " part on the active line
        decorations.push(Decoration.mark({ class: "cm-live-dim" }).range(line.from, hashesEnd))
      }

      // Apply header styling to the content (always)
      if (content.length > 0) {
        decorations.push(
          Decoration.mark({
            class: `cm-live-header cm-live-header-${level}`,
          }).range(hashesEnd, line.to),
        )
      }
      continue
    }

    // Process bullet list items (- text or * text, but NOT tasks)
    const bulletMatch = line.text.match(BULLET_LIST_REGEX)
    if (bulletMatch) {
      const indent = bulletMatch[1].length
      const prefixEnd = line.from + indent + 2 // "- " or "* "

      decorations.push(Decoration.line({ class: "cm-live-list-line" }).range(line.from))

      if (!isActiveLine) {
        // Replace "- " with bullet widget
        decorations.push(
          Decoration.replace({ widget: new BulletWidget() }).range(line.from + indent, prefixEnd),
        )
      } else {
        decorations.push(
          Decoration.mark({ class: "cm-live-dim" }).range(line.from + indent, prefixEnd),
        )
      }

      // Process inline formatting for the rest
      const remainingText = line.text.slice(indent + 2)
      processInlineFormatting(remainingText, prefixEnd, decorations, isActiveLine)
      continue
    }

    // Process task checkboxes (- [ ] or - [x])
    const taskMatch = line.text.match(TASK_REGEX)
    if (taskMatch) {
      const [fullMatch, , checkChar] = taskMatch
      const isChecked = checkChar.toLowerCase() === "x"
      const taskSyntaxEnd = line.from + fullMatch.length

      if (!isActiveLine) {
        // Inactive line: full WYSIWYG — replace with checkbox widget
        decorations.push(Decoration.line({ class: "cm-live-task-line" }).range(line.from))
        decorations.push(
          Decoration.replace({
            widget: new CheckboxWidget(isChecked),
          }).range(line.from, taskSyntaxEnd),
        )
      } else {
        // Active line: dim the "- [ ] " part, no widget replacement
        decorations.push(Decoration.mark({ class: "cm-live-dim" }).range(line.from, taskSyntaxEnd))
      }

      // Apply done styling to content (always)
      if (taskSyntaxEnd < line.to) {
        decorations.push(
          Decoration.mark({
            class: isChecked ? "cm-live-task-content cm-live-task-done" : "",
          }).range(taskSyntaxEnd, line.to),
        )
      }

      // Process inline formatting for the rest of the task text
      const remainingText = line.text.slice(fullMatch.length)
      processInlineFormatting(remainingText, taskSyntaxEnd, decorations, isActiveLine)
      continue
    }

    // Process blockquotes (> text)
    const blockquoteMatch = line.text.match(BLOCKQUOTE_REGEX)
    if (blockquoteMatch) {
      const prefixEnd = line.from + blockquoteMatch[0].length

      // Add line decoration for blockquote styling (left border) — always
      decorations.push(Decoration.line({ class: "cm-live-blockquote-line" }).range(line.from))

      if (!isActiveLine) {
        // Hide the "> " prefix on inactive lines
        decorations.push(
          Decoration.replace({ widget: new HiddenWidget() }).range(line.from, prefixEnd),
        )
      } else {
        // Dim the "> " on active line
        decorations.push(Decoration.mark({ class: "cm-live-dim" }).range(line.from, prefixEnd))
      }

      const remainingText = line.text.slice(blockquoteMatch[0].length)
      processInlineFormatting(remainingText, prefixEnd, decorations, isActiveLine)
      continue
    }

    // Process inline formatting (bold, italic, strikethrough, inline code)
    processInlineFormatting(line.text, line.from, decorations, isActiveLine)
  }

  // Sort by position to ensure proper ordering
  decorations.sort((a, b) => a.from - b.from)

  return Decoration.set(decorations)
}

function processInlineFormatting(
  text: string,
  lineStart: number,
  decorations: Range<Decoration>[],
  isActiveLine = false,
) {
  const processedRanges: Array<{ from: number; to: number }> = []

  const isOverlapping = (from: number, to: number) => {
    return processedRanges.some(
      (range) => (from >= range.from && from < range.to) || (to > range.from && to <= range.to),
    )
  }

  // Helper: hide markers on inactive lines, dim them on active line
  const hideOrDim = (from: number, to: number) => {
    if (isActiveLine) {
      decorations.push(Decoration.mark({ class: "cm-live-dim" }).range(from, to))
    } else {
      decorations.push(Decoration.replace({ widget: new HiddenWidget() }).range(from, to))
    }
  }

  // Process bold (**text**)
  let match: RegExpExecArray | null
  BOLD_REGEX.lastIndex = 0
  while ((match = BOLD_REGEX.exec(text)) !== null) {
    const startPos = lineStart + match.index
    const endPos = startPos + match[0].length
    const contentStart = startPos + 2
    const contentEnd = endPos - 2

    if (!isOverlapping(startPos, endPos)) {
      hideOrDim(startPos, contentStart)
      decorations.push(Decoration.mark({ class: "cm-live-bold" }).range(contentStart, contentEnd))
      hideOrDim(contentEnd, endPos)
      processedRanges.push({ from: startPos, to: endPos })
    }
  }

  // Process italic with asterisk (*text*) - must not be part of bold
  ITALIC_STAR_REGEX.lastIndex = 0
  while ((match = ITALIC_STAR_REGEX.exec(text)) !== null) {
    const startPos = lineStart + match.index
    const endPos = startPos + match[0].length
    const contentStart = startPos + 1
    const contentEnd = endPos - 1

    if (!isOverlapping(startPos, endPos)) {
      hideOrDim(startPos, contentStart)
      decorations.push(Decoration.mark({ class: "cm-live-italic" }).range(contentStart, contentEnd))
      hideOrDim(contentEnd, endPos)
      processedRanges.push({ from: startPos, to: endPos })
    }
  }

  // Process italic with underscore (_text_)
  ITALIC_UNDERSCORE_REGEX.lastIndex = 0
  while ((match = ITALIC_UNDERSCORE_REGEX.exec(text)) !== null) {
    const startPos = lineStart + match.index
    const endPos = startPos + match[0].length
    const contentStart = startPos + 1
    const contentEnd = endPos - 1

    if (!isOverlapping(startPos, endPos)) {
      hideOrDim(startPos, contentStart)
      decorations.push(Decoration.mark({ class: "cm-live-italic" }).range(contentStart, contentEnd))
      hideOrDim(contentEnd, endPos)
      processedRanges.push({ from: startPos, to: endPos })
    }
  }

  // Process strikethrough (~~text~~)
  STRIKETHROUGH_REGEX.lastIndex = 0
  while ((match = STRIKETHROUGH_REGEX.exec(text)) !== null) {
    const startPos = lineStart + match.index
    const endPos = startPos + match[0].length
    const contentStart = startPos + 2
    const contentEnd = endPos - 2

    if (!isOverlapping(startPos, endPos)) {
      hideOrDim(startPos, contentStart)
      decorations.push(
        Decoration.mark({ class: "cm-live-strikethrough" }).range(contentStart, contentEnd),
      )
      hideOrDim(contentEnd, endPos)
      processedRanges.push({ from: startPos, to: endPos })
    }
  }

  // Process inline code (`code`)
  INLINE_CODE_REGEX.lastIndex = 0
  while ((match = INLINE_CODE_REGEX.exec(text)) !== null) {
    const startPos = lineStart + match.index
    const endPos = startPos + match[0].length
    const contentStart = startPos + 1
    const contentEnd = endPos - 1

    if (!isOverlapping(startPos, endPos)) {
      hideOrDim(startPos, contentStart)
      decorations.push(
        Decoration.mark({ class: "cm-live-inline-code" }).range(contentStart, contentEnd),
      )
      hideOrDim(contentEnd, endPos)
      processedRanges.push({ from: startPos, to: endPos })
    }
  }
}

// CSS styles for live preview
const livePreviewTheme = EditorView.baseTheme({
  // Base styling — match view mode: font-size base, line-height 28px
  "&.cm-live-preview .cm-content": {
    lineHeight: "28px",
  },
  ".cm-live-header": {
    fontWeight: "var(--font-weight-bold)",
    lineHeight: "1.4",
    paddingTop: "calc(var(--font-size-base) * 0.5)",
    paddingBottom: "calc(var(--font-size-base) * 0.25)",
  },
  ".cm-live-header-1": {
    fontSize: "var(--font-size-xl)",
  },
  ".cm-live-header-2": {
    fontSize: "var(--font-size-lg)",
  },
  ".cm-live-header-3, .cm-live-header-4, .cm-live-header-5, .cm-live-header-6": {},
  ".cm-live-bold": {
    fontWeight: "var(--font-weight-bold)",
  },
  ".cm-live-italic": {
    fontStyle: "italic",
  },
  // Dim: syntax markers on the active line — visible but subtle
  ".cm-live-dim": {
    opacity: "0.3",
  },
  ".cm-live-strikethrough": {
    textDecoration: "line-through",
    color: "var(--color-text-secondary)",
  },
  ".cm-live-inline-code": {
    fontFamily: "var(--font-family-mono)",
    fontSize: "0.9em",
    borderRadius: "var(--border-radius-sm)",
    backgroundColor: "var(--color-bg-secondary)",
    paddingInline: "calc(var(--font-size-base) * 0.25)",
  },
  ".cm-live-blockquote-line": {
    position: "relative",
    paddingLeft: "calc(var(--font-size-base) * 1.25) !important",
    paddingTop: "2px",
    paddingBottom: "2px",
    marginLeft: "0 !important",
    textIndent: "0 !important",
    color: "var(--color-text-secondary)",
    fontStyle: "italic",
  },
  ".cm-live-blockquote-line::before": {
    content: '""',
    position: "absolute",
    top: "0",
    bottom: "0",
    left: "0",
    width: "3px",
    borderRadius: "var(--border-radius-sm)",
    backgroundColor: "var(--color-border)",
  },
  // Bullet list — matches view mode: size-7 container with 6px SVG circle
  // Match view mode: size-7 (28px) container + gap-1.5 (6px margin-right)
  ".cm-live-bullet-container": {
    display: "inline-grid",
    placeItems: "center",
    width: "28px",
    height: "28px",
    flexShrink: "0",
    verticalAlign: "middle",
    marginRight: "6px",
    color: "var(--color-text-secondary)",
  },
  // Match view mode: flex p-1.5 gap-1.5 (6px padding, 6px gap)
  ".cm-live-list-line": {
    marginLeft: "0 !important",
    textIndent: "0 !important",
    paddingTop: "6px",
    paddingBottom: "6px",
    paddingLeft: "6px",
  },
  // Match view mode: size-7 (28px) container + gap-1.5 (6px margin-right)
  ".cm-live-checkbox-container": {
    display: "inline-grid",
    placeItems: "center",
    width: "28px",
    height: "28px",
    flexShrink: "0",
    verticalAlign: "middle",
    marginRight: "6px",
  },
  ".cm-live-checkbox": {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    width: "16px",
    height: "16px",
    borderRadius: "4px",
    border: "1px solid var(--color-text-secondary)",
    backgroundColor: "transparent",
    fontSize: "10px",
    cursor: "pointer",
  },
  ".cm-live-checkbox-checked": {
    backgroundColor: "var(--color-border-focus)",
    borderColor: "var(--color-border-focus)",
    color: "var(--color-bg)",
  },
  ".cm-live-task-content": {
    flexGrow: "1",
  },
  ".cm-live-task-done": {
    textDecoration: "line-through",
    color: "var(--color-text-secondary)",
  },
  // Match view mode: flex p-1.5 gap-1.5 (6px padding, 6px gap)
  ".cm-live-task-line": {
    marginLeft: "0 !important",
    textIndent: "0 !important",
    paddingTop: "6px",
    paddingBottom: "6px",
    paddingLeft: "6px",
  },
})

// Add class to editor root for styling
const livePreviewClass = EditorView.editorAttributes.of({ class: "cm-live-preview" })

// Auto-continue task lists on Enter
const taskContinuation = keymap.of([
  {
    key: "Enter",
    run: (view) => {
      const { state } = view
      const { from } = state.selection.main
      const line = state.doc.lineAt(from)

      // Check if current line is a task
      const taskMatch = line.text.match(TASK_REGEX)
      if (taskMatch) {
        const [fullMatch, indent] = taskMatch
        const taskContent = line.text.slice(fullMatch.length).trim()

        // If task is empty, remove the task marker and don't continue
        if (!taskContent) {
          view.dispatch({
            changes: { from: line.from, to: line.to, insert: "" },
            selection: { anchor: line.from },
          })
          return true
        }

        // Insert new line with task marker (use - [ ] format as default)
        const newTaskMarker = `${indent}- [ ] `
        view.dispatch({
          changes: { from, to: from, insert: `\n${newTaskMarker}` },
          selection: { anchor: from + 1 + newTaskMarker.length },
        })
        return true
      }

      return false // Let default Enter behavior handle it
    },
  },
])

export function livePreviewExtension(): Extension {
  return [createLivePreviewField(), livePreviewTheme, livePreviewClass, taskContinuation]
}
