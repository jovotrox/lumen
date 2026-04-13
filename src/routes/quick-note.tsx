import { createFileRoute } from "@tanstack/react-router"
import { ReactCodeMirrorRef } from "@uiw/react-codemirror"
import React from "react"
import { NoteEditor } from "../components/note-editor"
import { isElectron } from "../utils/electron"
import { generateNoteId } from "../utils/note-id"
import { isTauri } from "../utils/tauri"
import { Button } from "../components/button"
import { CheckIcon16 } from "../components/icons"
import { useAtom, useAtomValue } from "jotai"
import { customThemesAtom, defaultFontAtom, quickNoteModeAtom, themeAtom } from "../global-state"
import { SegmentedControl } from "../components/segmented-control"
import { FormatToolbar } from "../components/format-toolbar"

export const Route = createFileRoute("/quick-note")({
  component: QuickNoteComponent,
})

function QuickNoteComponent() {
  const [noteId, setNoteId] = React.useState(generateNoteId)
  const [content, setContent] = React.useState("")
  const [hasUnsavedChanges, setHasUnsavedChanges] = React.useState(false)
  const [saved, setSaved] = React.useState(false)
  const [escPressedOnce, setEscPressedOnce] = React.useState(false)
  // Bumped on every selection/doc change to re-render the pinned toolbar with
  // accurate active-state highlights.
  const [, setSelTick] = React.useState(0)
  const editorRef = React.useRef<ReactCodeMirrorRef>(null)
  const escTimeoutRef = React.useRef<number | null>(null)

  // Reset state when Quick Note window is re-invoked (Electron reuses persisted window)
  React.useEffect(() => {
    if (!isElectron() || !window.electronAPI?.onQuickNoteReset) return
    const cleanup = window.electronAPI.onQuickNoteReset(() => {
      setContent("")
      setNoteId(generateNoteId())
      setHasUnsavedChanges(false)
      setSaved(false)
      setEscPressedOnce(false)
      // Clear editor content and refocus
      const view = editorRef.current?.view
      if (view) {
        view.dispatch({
          changes: { from: 0, to: view.state.doc.length, insert: "" },
        })
        view.focus()
      }
    })
    return cleanup
  }, [])
  const defaultFont = useAtomValue(defaultFontAtom)
  const themeId = useAtomValue(themeAtom)
  const customThemes = useAtomValue(customThemesAtom)
  const [mode, setMode] = useAtom(quickNoteModeAtom)

  // Apply font style
  React.useEffect(() => {
    const fontFamily = defaultFont === "mono" ? "monospace" : defaultFont
    document.documentElement.style.setProperty(
      "--font-family-content",
      `var(--font-family-${fontFamily})`,
    )
    document.documentElement.style.setProperty(
      "--font-family-mono",
      `var(--font-family-${fontFamily}-mono)`,
    )
  }, [defaultFont])

  // Apply theme
  React.useEffect(() => {
    import("../utils/themes").then(({ applyTheme, getAllThemes }) => {
      const allThemes = getAllThemes(customThemes)
      const theme = allThemes.find((t) => t.id === themeId) ?? null
      applyTheme(theme)
    })
  }, [themeId, customThemes])

  // Close window
  const closeWindow = React.useCallback(async () => {
    if (isTauri()) {
      const { getCurrentWindow } = await import("@tauri-apps/api/window")
      const currentWindow = getCurrentWindow()
      await currentWindow.close()
    } else if (isElectron()) {
      await window.electronAPI!.closeWindow()
    }
  }, [])

  // Handle ESC key - double press to close with unsaved changes
  const handleEsc = React.useCallback(() => {
    if (!hasUnsavedChanges) {
      closeWindow()
      return
    }

    if (escPressedOnce) {
      // Second ESC - close without saving
      closeWindow()
    } else {
      // First ESC - show warning
      setEscPressedOnce(true)
      // Reset after 2 seconds
      if (escTimeoutRef.current) {
        clearTimeout(escTimeoutRef.current)
      }
      escTimeoutRef.current = window.setTimeout(() => {
        setEscPressedOnce(false)
      }, 2000)
    }
  }, [hasUnsavedChanges, escPressedOnce, closeWindow])

  // Cleanup timeout on unmount
  React.useEffect(() => {
    return () => {
      if (escTimeoutRef.current) {
        clearTimeout(escTimeoutRef.current)
      }
    }
  }, [])

  // Force one re-render after mount so the pinned format toolbar can read
  // editorRef.current.view (which is null on the initial render).
  React.useEffect(() => {
    setSelTick((t) => t + 1)
  }, [])

  // Save note by emitting event to main window
  const handleSave = React.useCallback(async () => {
    if (!content.trim()) return

    if (isTauri()) {
      try {
        const { emitTo } = await import("@tauri-apps/api/event")
        // Emit event specifically to main window
        await emitTo("main", "quick-note-save", {
          noteId,
          content,
          mode,
        })
        setHasUnsavedChanges(false)
        setSaved(true)
        setEscPressedOnce(false)
        // Reset saved indicator after 2 seconds
        setTimeout(() => setSaved(false), 2000)
      } catch (error) {
        console.error("Failed to save note:", error)
      }
    } else if (isElectron()) {
      try {
        await window.electronAPI!.quickNoteSave({ noteId, content, mode })
        setHasUnsavedChanges(false)
        setSaved(true)
        setEscPressedOnce(false)
        setTimeout(() => setSaved(false), 2000)
      } catch (error) {
        console.error("Failed to save note:", error)
      }
    }
  }, [content, noteId, mode])

  // Handle content change
  const handleChange = React.useCallback((newContent: string) => {
    setContent(newContent)
    setHasUnsavedChanges(newContent.trim().length > 0)
    setSaved(false)
    setEscPressedOnce(false)
  }, [])

  // Keyboard shortcuts
  React.useEffect(() => {
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
    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [handleSave, handleEsc, closeWindow])

  // Only apply the semi-transparent tint on macOS, where the BrowserWindow has
  // vibrancy + transparent bg and the blur needs to show through. On Windows/Linux
  // the window bg is solid, so a partial tint would darken the effective color
  // (especially noticeable with light themes).
  const isMacElectron = isElectron() && /Mac/.test(navigator.userAgent)

  // index.css applies `body { bg-bg }` globally which blocks vibrancy from
  // showing through. Override it on the Quick Note macOS route so the frosted
  // blur is actually visible. This window is dedicated (only loads /quick-note)
  // so we don't need to restore on unmount.
  React.useEffect(() => {
    if (!isMacElectron) return
    document.documentElement.style.backgroundColor = "transparent"
    document.body.style.backgroundColor = "transparent"
    const root = document.getElementById("root")
    if (root) root.style.backgroundColor = "transparent"
  }, [isMacElectron])

  // Fade the editor's top & bottom edges into transparency so text scrolling
  // under the titlebar / over the toolbar doesn't hard-cut at the boundary.
  // Matches the pattern already used on tab close buttons (titlebar.tsx:147).
  const editorFadeMask =
    "linear-gradient(to bottom, transparent 0, black 12px, black calc(100% - 14px), transparent 100%)"

  return (
    <div
      className={
        isMacElectron
          ? "flex h-screen flex-col font-content text-text"
          : "flex h-screen flex-col bg-bg font-content text-text"
      }
      style={
        isMacElectron
          ? { backgroundColor: "color-mix(in srgb, var(--color-bg) 30%, transparent)" }
          : undefined
      }
    >
      {/* Header — draggable, with traffic light space on left */}
      <div
        className="flex h-[38px] shrink-0 items-center justify-between px-3"
        style={{ WebkitAppRegion: "drag" } as React.CSSProperties}
      >
        <div className="w-[60px]" />
        <div
          className="flex items-center gap-2"
          style={{ WebkitAppRegion: "no-drag" } as React.CSSProperties}
        >
          <SegmentedControl aria-label="Quick note mode" size="small">
            <SegmentedControl.Segment selected={mode === "note"} onClick={() => setMode("note")}>
              Note
            </SegmentedControl.Segment>
            <SegmentedControl.Segment selected={mode === "inbox"} onClick={() => setMode("inbox")}>
              Inbox
            </SegmentedControl.Segment>
          </SegmentedControl>
        </div>
        <div
          className="flex w-[60px] items-center justify-end gap-1"
          style={{ WebkitAppRegion: "no-drag" } as React.CSSProperties}
        >
          {saved && (
            <span className="flex items-center gap-1 text-xs text-text-success">
              <CheckIcon16 className="size-3" />
            </span>
          )}
          <Button variant="primary" size="small" onClick={handleSave} disabled={!content.trim()}>
            Save
          </Button>
        </div>
      </div>

      {/* Editor */}
      <div
        className="flex-1 overflow-auto px-4 pt-3 pb-2"
        style={{ maskImage: editorFadeMask, WebkitMaskImage: editorFadeMask }}
      >
        <NoteEditor
          ref={editorRef}
          defaultValue={content}
          placeholder="Start typing..."
          // eslint-disable-next-line jsx-a11y/no-autofocus -- Quick note window should focus immediately
          autoFocus
          onChange={handleChange}
          minHeight={200}
          livePreview
          onStateChange={(update) => {
            if (update.selectionSet || update.docChanged) {
              setSelTick((t) => t + 1)
            }
          }}
        />
      </div>

      {/* Pinned format toolbar */}
      {editorRef.current?.view ? (
        <div className="shrink-0 px-2 py-1">
          <FormatToolbar
            variant="pinned"
            editorView={editorRef.current.view}
            selectionFrom={editorRef.current.view.state.selection.main.from}
            selectionTo={editorRef.current.view.state.selection.main.to}
          />
        </div>
      ) : null}

      {/* Footer */}
      <div className="shrink-0 px-4 py-1.5">
        {escPressedOnce ? (
          <div className="text-center text-xs text-text-pending">
            Press ESC again to discard changes
          </div>
        ) : (
          <div className="flex items-center justify-between text-[10px] text-text-tertiary opacity-50">
            <span>⌘S save · ⌘↵ save+close</span>
            <span>ESC close</span>
          </div>
        )}
      </div>
    </div>
  )
}
