import * as Portal from "@radix-ui/react-portal"
import { EditorView } from "@codemirror/view"
import {
  Bold,
  Braces,
  Code,
  Italic,
  Link,
  List,
  ListChecks,
  ListOrdered,
  Quote,
  Strikethrough,
} from "lucide-react"
import React from "react"
import {
  getHeadingLevel,
  insertLink,
  insertWikilink,
  isBlockquoteActive,
  isBoldActive,
  isBulletListActive,
  isInlineCodeActive,
  isItalicActive,
  isNumberedListActive,
  isStrikethroughActive,
  isTaskListActive,
  setHeading,
  toggleBlockquote,
  toggleBold,
  toggleBulletList,
  toggleCodeBlock,
  toggleInlineCode,
  toggleItalic,
  toggleNumberedList,
  toggleStrikethrough,
  toggleTaskList,
} from "../codemirror-extensions/format-commands"
import { cx } from "../utils/cx"

type FormatToolbarProps = {
  editorView: EditorView | null
  selectionFrom: number
  selectionTo: number
}

function isInsideFrontmatter(view: EditorView, from: number): boolean {
  const doc = view.state.doc.toString()
  if (!doc.startsWith("---\n")) return false
  const closingIdx = doc.indexOf("\n---", 4)
  if (closingIdx === -1) return false
  return from <= closingIdx + 4
}

const preventFocus = (e: React.MouseEvent) => e.preventDefault()

export function FormatToolbar({ editorView, selectionFrom, selectionTo }: FormatToolbarProps) {
  const toolbarRef = React.useRef<HTMLDivElement>(null)
  const [coords, setCoords] = React.useState<{ top: number; left: number } | null>(null)

  React.useLayoutEffect(() => {
    if (!editorView || selectionFrom === selectionTo) {
      setCoords(null)
      return
    }

    // Don't show inside frontmatter
    if (isInsideFrontmatter(editorView, selectionFrom)) {
      setCoords(null)
      return
    }

    // Don't show when autocomplete is active
    if (editorView.dom.querySelector(".cm-tooltip-autocomplete")) {
      setCoords(null)
      return
    }

    const fromCoords = editorView.coordsAtPos(selectionFrom)
    const toCoords = editorView.coordsAtPos(selectionTo)

    if (!fromCoords || !toCoords) {
      setCoords(null)
      return
    }

    const toolbarWidth = toolbarRef.current?.offsetWidth || 300
    const toolbarHeight = toolbarRef.current?.offsetHeight || 36

    const centeredLeft = (fromCoords.left + toCoords.left) / 2 - toolbarWidth / 2
    const left = Math.min(window.innerWidth - toolbarWidth - 8, Math.max(8, centeredLeft))

    const topAbove = fromCoords.top - toolbarHeight - 8
    const finalTop = topAbove < 40 ? toCoords.bottom + 8 : topAbove

    setCoords({ top: finalTop, left })
  }, [editorView, selectionFrom, selectionTo])

  if (!editorView || selectionFrom === selectionTo) return null

  const state = editorView.state
  const headingLevel = getHeadingLevel(state)

  const btnClass =
    "grid h-7 w-7 place-items-center rounded text-text-secondary hover:bg-bg-hover hover:text-text cursor-pointer"
  const activeBtnClass = "bg-bg-active text-text"
  const separatorClass = "mx-0.5 h-4 w-px bg-border-secondary"

  const style: React.CSSProperties = coords
    ? { position: "fixed", top: coords.top, left: coords.left, zIndex: 9999 }
    : { position: "fixed", top: -9999, left: -9999, zIndex: 9999 }

  return (
    <Portal.Root>
      <div
        ref={toolbarRef}
        role="toolbar"
        aria-label="Text formatting"
        style={style}
        className="card-2 flex items-center gap-0.5 rounded-lg p-1"
      >
        {/* Group 1 — Inline */}
        <button
          className={cx(btnClass, isBoldActive(state) && activeBtnClass)}
          title="Bold (⌘B)"
          onMouseDown={preventFocus}
          onClick={() => {
            toggleBold(editorView)
          }}
        >
          <Bold size={14} />
        </button>
        <button
          className={cx(btnClass, isItalicActive(state) && activeBtnClass)}
          title="Italic (⌘I)"
          onMouseDown={preventFocus}
          onClick={() => {
            toggleItalic(editorView)
          }}
        >
          <Italic size={14} />
        </button>
        <button
          className={cx(btnClass, isStrikethroughActive(state) && activeBtnClass)}
          title="Strikethrough (⌘⇧X)"
          onMouseDown={preventFocus}
          onClick={() => {
            toggleStrikethrough(editorView)
          }}
        >
          <Strikethrough size={14} />
        </button>
        <button
          className={cx(btnClass, isInlineCodeActive(state) && activeBtnClass)}
          title="Inline Code"
          onMouseDown={preventFocus}
          onClick={() => {
            toggleInlineCode(editorView)
          }}
        >
          <Code size={14} />
        </button>

        <div className={separatorClass} />

        {/* Group 2 — Blocks */}
        <button
          className={cx(btnClass, headingLevel === 1 && activeBtnClass)}
          title="Heading 1"
          onMouseDown={preventFocus}
          onClick={() => {
            setHeading(editorView, 1)
          }}
        >
          <span className="text-[11px] font-bold">H1</span>
        </button>
        <button
          className={cx(btnClass, headingLevel === 2 && activeBtnClass)}
          title="Heading 2"
          onMouseDown={preventFocus}
          onClick={() => {
            setHeading(editorView, 2)
          }}
        >
          <span className="text-[11px] font-bold">H2</span>
        </button>
        <button
          className={cx(btnClass, headingLevel === 3 && activeBtnClass)}
          title="Heading 3"
          onMouseDown={preventFocus}
          onClick={() => {
            setHeading(editorView, 3)
          }}
        >
          <span className="text-[11px] font-bold">H3</span>
        </button>
        <button
          className={cx(btnClass, isBlockquoteActive(state) && activeBtnClass)}
          title="Blockquote"
          onMouseDown={preventFocus}
          onClick={() => {
            toggleBlockquote(editorView)
          }}
        >
          <Quote size={14} />
        </button>
        <button
          className={cx(btnClass)}
          title="Code Block"
          onMouseDown={preventFocus}
          onClick={() => {
            toggleCodeBlock(editorView)
          }}
        >
          <Braces size={14} />
        </button>

        <div className={separatorClass} />

        {/* Group 3 — Lists */}
        <button
          className={cx(btnClass, isBulletListActive(state) && activeBtnClass)}
          title="Bullet List (⌘⇧8)"
          onMouseDown={preventFocus}
          onClick={() => {
            toggleBulletList(editorView)
          }}
        >
          <List size={14} />
        </button>
        <button
          className={cx(btnClass, isNumberedListActive(state) && activeBtnClass)}
          title="Numbered List (⌘⇧7)"
          onMouseDown={preventFocus}
          onClick={() => {
            toggleNumberedList(editorView)
          }}
        >
          <ListOrdered size={14} />
        </button>
        <button
          className={cx(btnClass, isTaskListActive(state) && activeBtnClass)}
          title="Task List"
          onMouseDown={preventFocus}
          onClick={() => {
            toggleTaskList(editorView)
          }}
        >
          <ListChecks size={14} />
        </button>

        <div className={separatorClass} />

        {/* Group 4 — Links */}
        <button
          className={cx(btnClass)}
          title="Link"
          onMouseDown={preventFocus}
          onClick={() => {
            insertLink(editorView)
          }}
        >
          <Link size={14} />
        </button>
        <button
          className={cx(btnClass)}
          title="Wikilink"
          onMouseDown={preventFocus}
          onClick={() => {
            insertWikilink(editorView)
          }}
        >
          <span className="text-[10px] font-mono">{"[[]]"}</span>
        </button>
      </div>
    </Portal.Root>
  )
}
