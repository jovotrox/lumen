import { EditorState, Extension, Range, StateField } from "@codemirror/state"
import { Decoration, DecorationSet, EditorView, keymap, WidgetType } from "@codemirror/view"

/**
 * Live Preview Extension for CodeMirror
 *
 * Provides WYSIWYG-style live preview where markdown syntax is always hidden
 * and formatting is always rendered visually. The underlying document is still
 * markdown — use the format toolbar or keyboard shortcuts to change formatting.
 *
 * Features: Headers, Bold, Italic, Task Lists
 */

// Regex patterns for markdown syntax
const HEADER_REGEX = /^(#{1,6})\s+(.*)$/
// Matches: "- [ ]", "- [x]" with optional leading whitespace
const TASK_REGEX = /^(\s*)-\s+\[([ xX])\]\s*/
const BOLD_REGEX = /\*\*([^*]+)\*\*/g
const ITALIC_STAR_REGEX = /(?<!\*)\*([^*]+)\*(?!\*)/g
const ITALIC_UNDERSCORE_REGEX = /(?<!_)_([^_]+)_(?!_)/g

// Widget to render nothing (hides syntax markers)
class HiddenWidget extends WidgetType {
  toDOM() {
    const span = document.createElement("span")
    span.style.display = "none"
    return span
  }
}

// Widget for checkbox (task list item) - replicates read mode structure
class CheckboxWidget extends WidgetType {
  constructor(private checked: boolean) {
    super()
  }

  toDOM() {
    // Container: size-7 (28px) grid place-items-center
    const container = document.createElement("span")
    container.className = "cm-live-checkbox-container"

    // Checkbox inside
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
      if (tr.docChanged) {
        return createDecorations(tr.state)
      }
      return decorations
    },
    provide: (f) => EditorView.decorations.from(f),
  })
}

function createDecorations(state: EditorState): DecorationSet {
  const decorations: Range<Decoration>[] = []

  for (let i = 1; i <= state.doc.lines; i++) {
    const line = state.doc.line(i)

    // Process headers
    const headerMatch = line.text.match(HEADER_REGEX)
    if (headerMatch) {
      const [_fullMatch, hashes, content] = headerMatch
      const level = hashes.length
      const hashesEnd = line.from + hashes.length + 1 // +1 for space

      // Hide the "# " part
      decorations.push(
        Decoration.replace({
          widget: new HiddenWidget(),
        }).range(line.from, hashesEnd),
      )

      // Apply header styling to the content
      if (content.length > 0) {
        decorations.push(
          Decoration.mark({
            class: `cm-live-header cm-live-header-${level}`,
          }).range(hashesEnd, line.to),
        )
      }
      continue // Headers are processed, skip inline formatting for this line
    }

    // Process task checkboxes (- [ ] or - [x])
    const taskMatch = line.text.match(TASK_REGEX)
    if (taskMatch) {
      const [fullMatch, , checkChar] = taskMatch
      const isChecked = checkChar.toLowerCase() === "x"
      const taskSyntaxEnd = line.from + fullMatch.length

      // Add line decoration for extra padding on task lines
      decorations.push(
        Decoration.line({
          class: "cm-live-task-line",
        }).range(line.from),
      )

      // Replace "- [ ] " or "- [x] " with checkbox widget
      decorations.push(
        Decoration.replace({
          widget: new CheckboxWidget(isChecked),
        }).range(line.from, taskSyntaxEnd),
      )

      // Wrap the task content in a span
      if (taskSyntaxEnd < line.to) {
        decorations.push(
          Decoration.mark({
            class: isChecked ? "cm-live-task-content cm-live-task-done" : "cm-live-task-content",
          }).range(taskSyntaxEnd, line.to),
        )
      }

      // Process inline formatting for the rest of the task text
      const remainingText = line.text.slice(fullMatch.length)
      processInlineFormatting(remainingText, taskSyntaxEnd, decorations)
      continue
    }

    // Process inline formatting (bold, italic)
    processInlineFormatting(line.text, line.from, decorations)
  }

  // Sort by position to ensure proper ordering
  decorations.sort((a, b) => a.from - b.from)

  return Decoration.set(decorations)
}

function processInlineFormatting(
  text: string,
  lineStart: number,
  decorations: Range<Decoration>[],
) {
  // Track ranges already processed to avoid overlapping decorations
  const processedRanges: Array<{ from: number; to: number }> = []

  const isOverlapping = (from: number, to: number) => {
    return processedRanges.some(
      (range) => (from >= range.from && from < range.to) || (to > range.from && to <= range.to),
    )
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
      // Hide opening **
      decorations.push(
        Decoration.replace({ widget: new HiddenWidget() }).range(startPos, contentStart),
      )

      // Apply bold styling to content
      decorations.push(Decoration.mark({ class: "cm-live-bold" }).range(contentStart, contentEnd))

      // Hide closing **
      decorations.push(Decoration.replace({ widget: new HiddenWidget() }).range(contentEnd, endPos))

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
      // Hide opening *
      decorations.push(
        Decoration.replace({ widget: new HiddenWidget() }).range(startPos, contentStart),
      )

      // Apply italic styling to content
      decorations.push(Decoration.mark({ class: "cm-live-italic" }).range(contentStart, contentEnd))

      // Hide closing *
      decorations.push(Decoration.replace({ widget: new HiddenWidget() }).range(contentEnd, endPos))

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
      // Hide opening _
      decorations.push(
        Decoration.replace({ widget: new HiddenWidget() }).range(startPos, contentStart),
      )

      // Apply italic styling to content
      decorations.push(Decoration.mark({ class: "cm-live-italic" }).range(contentStart, contentEnd))

      // Hide closing _
      decorations.push(Decoration.replace({ widget: new HiddenWidget() }).range(contentEnd, endPos))

      processedRanges.push({ from: startPos, to: endPos })
    }
  }
}

// CSS styles for live preview
const livePreviewTheme = EditorView.baseTheme({
  // Base styling for live preview mode (similar to read mode)
  "&.cm-live-preview .cm-content": {
    lineHeight: "1.75",
  },
  ".cm-live-header": {
    fontWeight: "var(--font-weight-bold)",
    lineHeight: "1.4",
  },
  ".cm-live-header-1": {
    fontSize: "var(--font-size-xl)",
    letterSpacing: "-0.01em",
  },
  ".cm-live-header-2": {
    fontSize: "var(--font-size-lg)",
  },
  ".cm-live-header-3": {
    fontSize: "var(--font-size-lg)",
  },
  ".cm-live-header-4, .cm-live-header-5, .cm-live-header-6": {
    fontSize: "var(--font-size-base)",
  },
  ".cm-live-bold": {
    fontWeight: "var(--font-weight-bold)",
  },
  ".cm-live-italic": {
    fontStyle: "italic",
  },
  // Checkbox container with margin for spacing
  ".cm-live-checkbox-container": {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: "0",
    marginRight: "8px",
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
  ".cm-live-task-line": {
    display: "flex !important",
    alignItems: "center",
    paddingTop: "4px",
    paddingBottom: "4px",
    marginLeft: "0 !important",
    textIndent: "0 !important",
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
