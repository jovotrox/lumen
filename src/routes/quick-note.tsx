import { createFileRoute } from "@tanstack/react-router"
import { ReactCodeMirrorRef } from "@uiw/react-codemirror"
import React from "react"
import { NoteEditor } from "../components/note-editor"
import { generateNoteId } from "../utils/note-id"
import { isTauri } from "../utils/tauri"
import { Button } from "../components/button"
import { CheckIcon16 } from "../components/icons"
import { useAtomValue } from "jotai"
import { customThemesAtom, defaultFontAtom, themeAtom } from "../global-state"

export const Route = createFileRoute("/quick-note")({
  component: QuickNoteComponent,
})

function QuickNoteComponent() {
  const [noteId] = React.useState(() => generateNoteId())
  const [content, setContent] = React.useState("")
  const [hasUnsavedChanges, setHasUnsavedChanges] = React.useState(false)
  const [saved, setSaved] = React.useState(false)
  const [escPressedOnce, setEscPressedOnce] = React.useState(false)
  const editorRef = React.useRef<ReactCodeMirrorRef>(null)
  const escTimeoutRef = React.useRef<number | null>(null)
  const defaultFont = useAtomValue(defaultFontAtom)
  const themeId = useAtomValue(themeAtom)
  const customThemes = useAtomValue(customThemesAtom)

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
        })
        setHasUnsavedChanges(false)
        setSaved(true)
        setEscPressedOnce(false)
        // Reset saved indicator after 2 seconds
        setTimeout(() => setSaved(false), 2000)
      } catch (error) {
        console.error("Failed to save note:", error)
      }
    }
  }, [content, noteId])

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
  }, [handleSave, handleEsc])

  return (
    <div className="flex h-screen flex-col bg-bg font-content text-text">
      {/* Header */}
      <div className="flex shrink-0 items-center justify-between border-b border-border-secondary px-3 py-2">
        <span className="text-xs font-medium text-text-secondary">Quick Note</span>
        <div className="flex items-center gap-1">
          {saved && (
            <span className="flex items-center gap-1 text-xs text-text-success">
              <CheckIcon16 className="size-3" />
              Saved
            </span>
          )}
          <Button variant="primary" size="small" onClick={handleSave} disabled={!content.trim()}>
            Save
          </Button>
        </div>
      </div>

      {/* Editor */}
      <div className="flex-1 overflow-auto p-3">
        <NoteEditor
          ref={editorRef}
          defaultValue={content}
          placeholder="Start typing..."
          // eslint-disable-next-line jsx-a11y/no-autofocus -- Quick note window should focus immediately
          autoFocus
          onChange={handleChange}
          minHeight={200}
          livePreview
        />
      </div>

      {/* Footer with shortcuts / ESC warning */}
      <div className="shrink-0 border-t border-border-secondary px-3 py-1.5">
        {escPressedOnce ? (
          <div className="text-center text-xs text-text-pending">
            Press ESC again to discard changes
          </div>
        ) : (
          <div className="flex items-center justify-between text-[10px] text-text-tertiary">
            <span>⌘S to save</span>
            <span>ESC to close</span>
          </div>
        )}
      </div>
    </div>
  )
}
