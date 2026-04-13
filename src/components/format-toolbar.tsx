import * as Portal from "@radix-ui/react-portal"
import { EditorView } from "@codemirror/view"
import {
  AtSign,
  Bold,
  Braces,
  Code,
  Italic,
  Link,
  List,
  ListChecks,
  ListOrdered,
  Strikethrough,
  TextQuote,
} from "lucide-react"
import React from "react"
import { Tooltip } from "./tooltip"
import { Keys } from "./keys"
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
  /**
   * "floating" (default) — shown on text selection, positioned above the selection via a Portal.
   * "pinned" — always visible, rendered inline in the parent's flow (no portal, no positioning).
   */
  variant?: "floating" | "pinned"
}

function isInsideFrontmatter(view: EditorView, from: number): boolean {
  const doc = view.state.doc.toString()
  if (!doc.startsWith("---\n")) return false
  const closingIdx = doc.indexOf("\n---", 4)
  if (closingIdx === -1) return false
  return from <= closingIdx + 4
}

const preventFocus = (e: React.MouseEvent) => e.preventDefault()

type ToolbarButtonProps = {
  label: string
  shortcut?: string[]
  active?: boolean
  onClick: () => void
  children: React.ReactNode
}

function ToolbarButton({ label, shortcut, active, onClick, children }: ToolbarButtonProps) {
  const btnClass =
    "grid h-7 w-7 place-items-center rounded text-text-secondary hover:bg-bg-hover hover:text-text cursor-pointer"
  const activeClass = "bg-bg-active text-text"

  const trigger = (
    <button
      type="button"
      aria-label={label}
      className={cx(btnClass, active && activeClass)}
      onMouseDown={preventFocus}
      onClick={onClick}
    >
      {children}
    </button>
  )

  return (
    <Tooltip>
      <Tooltip.Trigger render={trigger} />
      <Tooltip.Content side="top" sideOffset={6}>
        <div className="flex items-center gap-1.5 text-xs">
          <span>{label}</span>
          {shortcut ? <Keys keys={shortcut} className="text-text-secondary" /> : null}
        </div>
      </Tooltip.Content>
    </Tooltip>
  )
}

export function FormatToolbar({
  editorView,
  selectionFrom,
  selectionTo,
  variant = "floating",
}: FormatToolbarProps) {
  const toolbarRef = React.useRef<HTMLDivElement>(null)
  const [coords, setCoords] = React.useState<{ top: number; left: number } | null>(null)
  const isPinned = variant === "pinned"

  React.useLayoutEffect(() => {
    if (isPinned) return
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
    if (document.querySelector(".cm-tooltip-autocomplete")) {
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
  }, [editorView, selectionFrom, selectionTo, isPinned])

  if (!editorView) return null
  // Floating variant only renders when there's a non-empty selection.
  if (!isPinned && selectionFrom === selectionTo) return null

  const state = editorView.state
  const headingLevel = getHeadingLevel(state)

  const separatorClass = "mx-0.5 h-4 w-px bg-border-secondary"

  const floatingStyle: React.CSSProperties = coords
    ? { position: "fixed", top: coords.top, left: coords.left, zIndex: 9999 }
    : { position: "fixed", top: -9999, left: -9999, zIndex: 9999 }

  const toolbarContent = (
    <div
      ref={toolbarRef}
      role="toolbar"
      aria-label="Text formatting"
      style={isPinned ? undefined : floatingStyle}
      className={cx(
        "flex items-center gap-0.5 rounded-lg p-1",
        isPinned ? "w-full justify-center" : "card-2",
      )}
    >
      {/* Group 1 — Inline */}
      <ToolbarButton
        label="Bold"
        shortcut={["⌘", "B"]}
        active={isBoldActive(state)}
        onClick={() => toggleBold(editorView)}
      >
        <Bold size={14} />
      </ToolbarButton>
      <ToolbarButton
        label="Italic"
        shortcut={["⌘", "I"]}
        active={isItalicActive(state)}
        onClick={() => toggleItalic(editorView)}
      >
        <Italic size={14} />
      </ToolbarButton>
      <ToolbarButton
        label="Strikethrough"
        shortcut={["⌘", "⇧", "X"]}
        active={isStrikethroughActive(state)}
        onClick={() => toggleStrikethrough(editorView)}
      >
        <Strikethrough size={14} />
      </ToolbarButton>
      <ToolbarButton
        label="Inline code"
        shortcut={["⌘", "⇧", "M"]}
        active={isInlineCodeActive(state)}
        onClick={() => toggleInlineCode(editorView)}
      >
        <Code size={14} />
      </ToolbarButton>

      <div className={separatorClass} />

      {/* Group 2 — Blocks */}
      <ToolbarButton
        label="Heading 1"
        active={headingLevel === 1}
        onClick={() => setHeading(editorView, 1)}
      >
        <span className="text-[11px] font-bold">H1</span>
      </ToolbarButton>
      <ToolbarButton
        label="Heading 2"
        active={headingLevel === 2}
        onClick={() => setHeading(editorView, 2)}
      >
        <span className="text-[11px] font-bold">H2</span>
      </ToolbarButton>
      <ToolbarButton
        label="Heading 3"
        active={headingLevel === 3}
        onClick={() => setHeading(editorView, 3)}
      >
        <span className="text-[11px] font-bold">H3</span>
      </ToolbarButton>
      <ToolbarButton
        label="Quote"
        shortcut={["⌘", "⇧", "B"]}
        active={isBlockquoteActive(state)}
        onClick={() => toggleBlockquote(editorView)}
      >
        <TextQuote size={14} />
      </ToolbarButton>
      <ToolbarButton label="Code block" onClick={() => toggleCodeBlock(editorView)}>
        <Braces size={14} />
      </ToolbarButton>

      <div className={separatorClass} />

      {/* Group 3 — Lists */}
      <ToolbarButton
        label="Bullet list"
        shortcut={["⌘", "⇧", "8"]}
        active={isBulletListActive(state)}
        onClick={() => toggleBulletList(editorView)}
      >
        <List size={14} />
      </ToolbarButton>
      <ToolbarButton
        label="Numbered list"
        shortcut={["⌘", "⇧", "7"]}
        active={isNumberedListActive(state)}
        onClick={() => toggleNumberedList(editorView)}
      >
        <ListOrdered size={14} />
      </ToolbarButton>
      <ToolbarButton
        label="Task list"
        shortcut={["⌘", "⇧", "T"]}
        active={isTaskListActive(state)}
        onClick={() => toggleTaskList(editorView)}
      >
        <ListChecks size={14} />
      </ToolbarButton>

      <div className={separatorClass} />

      {/* Group 4 — Links */}
      <ToolbarButton label="Link" shortcut={["⌘", "K"]} onClick={() => insertLink(editorView)}>
        <Link size={14} />
      </ToolbarButton>
      <ToolbarButton label="Mention note" onClick={() => insertWikilink(editorView)}>
        <AtSign size={14} />
      </ToolbarButton>
    </div>
  )

  if (isPinned) return toolbarContent
  return <Portal.Root>{toolbarContent}</Portal.Root>
}
