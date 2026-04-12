import { createFileRoute, Outlet, useNavigate, useRouter } from "@tanstack/react-router"
import { useAtom, useAtomValue, useSetAtom } from "jotai"
import { selectAtom, useAtomCallback } from "jotai/utils"
import React from "react"
import { useEvent, useNetworkState } from "react-use"
import { z } from "zod/v3"
import { AppLayout } from "../components/app-layout"
import { CommandMenu } from "../components/command-menu"
import { DevBar } from "../components/dev-bar"
import { ErrorIcon16 } from "../components/icons"
import { UpdateBanner } from "../components/update-banner"
import {
  FloatingConversationInput,
  Tool,
  voiceConversationMachineAtom,
} from "../components/voice-conversation"
import {
  customThemesAtom,
  defaultFontAtom,
  epaperAtom,
  globalStateMachineAtom,
  notesAtom,
  nudgeNotificationsAtom,
  nudgesAtom,
  tagsAtom,
  templatesAtom,
  themeAtom,
} from "../global-state"
import { useExternalLinks } from "../hooks/use-external-links"
import { useSearchNotes } from "../hooks/search-notes"
import { useSettingsSync } from "../hooks/use-settings-sync"
import { useThemeSync } from "../hooks/use-theme-sync"
import { useValueRef } from "../hooks/value-ref"
import { generateNoteId } from "../utils/note-id"
import { notificationSound, playSound } from "../utils/sounds"
import { isElectron } from "../utils/electron"
import { isTauri } from "../utils/tauri"
import { updateFrontmatterValue } from "../utils/frontmatter"

export const Route = createFileRoute("/_appRoot")({
  component: RouteComponent,
  head: () => ({
    links: [
      {
        rel: "icon",
        href: import.meta.env.DEV ? "/favicon-dev.svg" : "/favicon.svg",
      },
    ],
  }),
})

const errorAtom = selectAtom(globalStateMachineAtom, (state) => state.context.error)

function RouteComponent() {
  // Open external links in system browser when running in Tauri
  useExternalLinks()

  // Sync custom themes and settings between localStorage and GitHub repo
  useThemeSync()
  useSettingsSync()

  const error = useAtomValue(errorAtom)
  const send = useSetAtom(globalStateMachineAtom)
  const searchNotes = useSearchNotes()
  const searchNotesRef = useValueRef(searchNotes)
  const getNotes = useAtomCallback(React.useCallback((get) => get(notesAtom), []))
  const getTemplates = useAtomCallback(React.useCallback((get) => get(templatesAtom), []))
  const getTags = useAtomCallback(React.useCallback((get) => get(tagsAtom), []))
  const [, sendVoiceConversation] = useAtom(voiceConversationMachineAtom)
  const router = useRouter()
  const navigate = useNavigate()
  const { online } = useNetworkState()
  const rootRef = React.useRef<HTMLDivElement>(null)

  // Sync when the app becomes visible again
  useEvent("visibilitychange", () => {
    if (document.visibilityState === "visible" && online) {
      send("SYNC")
    }
  })

  useEvent("online", () => {
    send("SYNC")
  })

  // Nudge notifications (once per day, on visibility change)
  const nudges = useAtomValue(nudgesAtom)
  const nudgeNotifications = useAtomValue(nudgeNotificationsAtom)

  React.useEffect(() => {
    if (!nudgeNotifications || nudges.length === 0) return
    if (!("Notification" in window)) return

    const today = new Date().toDateString()
    const lastNotified = localStorage.getItem("nudge_last_notified")
    if (lastNotified === today) return

    if (Notification.permission === "default") {
      Notification.requestPermission()
      return
    }
    if (Notification.permission !== "granted") return

    localStorage.setItem("nudge_last_notified", today)
    const top3 = nudges
      .slice(0, 3)
      .map((n) => n.message)
      .join("\n")
    new Notification(
      `Lumen — ${nudges.length} item${nudges.length > 1 ? "s" : ""} need attention`,
      {
        body: top3,
      },
    )
  }, [nudges, nudgeNotifications])

  // Listen for quick-note save events from the quick-note window (Tauri only)
  React.useEffect(() => {
    if (!isTauri()) return

    let unlisten: (() => void) | undefined

    const setupListener = async () => {
      const { listen } = await import("@tauri-apps/api/event")
      unlisten = await listen<{ noteId: string; content: string; mode: "note" | "inbox" }>(
        "quick-note-save",
        (event) => {
          const { noteId, content, mode } = event.payload

          const properties: Record<string, unknown> = { updated_at: new Date() }

          if (mode === "inbox") {
            properties.type = "inbox"
            properties.status = "unprocessed"
            properties.source = "quick-note"
          }

          const enrichedContent = updateFrontmatterValue({
            content,
            properties,
          })

          send({
            type: "WRITE_FILES",
            markdownFiles: { [`${noteId}.md`]: enrichedContent },
          })
        },
      )
    }

    setupListener()

    return () => {
      unlisten?.()
    }
  }, [send])

  // Listen for quick-note save events from the quick-note window (Electron only)
  React.useEffect(() => {
    if (!isElectron()) return

    const unlisten = window.electronAPI!.onQuickNoteSaved(
      (payload: { noteId: string; content: string; mode: string }) => {
        const properties: Record<string, unknown> = { updated_at: new Date() }

        if (payload.mode === "inbox") {
          properties.type = "inbox"
          properties.status = "unprocessed"
          properties.source = "quick-note"
        }

        const enrichedContent = updateFrontmatterValue({
          content: payload.content,
          properties,
        })

        send({
          type: "WRITE_FILES",
          markdownFiles: { [`${payload.noteId}.md`]: enrichedContent },
        })
      },
    )

    return unlisten
  }, [send])

  // Notify voice assistant when the route changes
  React.useEffect(() => {
    const unsubscribe = router.subscribe("onRendered", ({ pathChanged, toLocation }) => {
      if (pathChanged) {
        sendVoiceConversation({ type: "ROUTE_CHANGED", path: toLocation.pathname })
      }
    })

    return () => unsubscribe()
  }, [router, sendVoiceConversation])

  // Add voice conversation tools
  React.useEffect(() => {
    const tools = [
      {
        name: "read_note",
        description: "Read the content of a specific note by its ID.",
        parameters: z.object({
          noteId: z.string().describe("The ID of the note to read"),
        }),
        execute: async ({ noteId }) => {
          const notes = getNotes()
          const note = notes.get(noteId)
          if (!note) {
            return JSON.stringify({ error: "Note not found" })
          }
          return JSON.stringify({
            note_id: note.id,
            content: note.content,
            backlinks: note.backlinks,
          })
        },
      } satisfies Tool<{ noteId: string }>,
      {
        name: "create_note",
        description:
          "Create an empty note. To add content, first create an empty note, then edit it separately.",
        parameters: z.object({}),
        execute: async () => {
          await navigate({
            to: "/notes/$",
            params: { _splat: generateNoteId() },
            search: {
              mode: "write",
              query: undefined,
              view: "grid",
            },
          })
          playSound(notificationSound)
          return JSON.stringify({ success: true })
        },
      } satisfies Tool<Record<string, never>>,
      {
        name: "search_notes",
        description: "Search through all of the user's notes.",
        parameters: z.object({
          query: z.string().describe("The search query to find relevant notes"),
        }),
        execute: async ({ query }) => {
          const results = searchNotesRef.current(query)
          const maxResults = 5
          return JSON.stringify({
            results: results.slice(0, maxResults).map((note) => ({
              note_id: note.id,
              content: note.content,
              backlinks: note.backlinks,
            })),
          })
        },
      } satisfies Tool<{ query: string }>,
      {
        name: "go_to_note",
        description: "Navigate to an existing note using its ID.",
        parameters: z.object({
          noteId: z.string().describe("The ID of the note to navigate to"),
        }),
        execute: async ({ noteId }) => {
          await navigate({
            to: "/notes/$",
            params: { _splat: noteId },
            search: {
              mode: "read",
              query: undefined,
              view: "grid",
            },
          })
          playSound(notificationSound)
          return JSON.stringify({ success: true })
        },
      } satisfies Tool<{ noteId: string }>,
      {
        name: "go_to_tag",
        description: "Navigate to a tag page listing all notes with that tag.",
        parameters: z.object({
          tag: z.string().describe("The name of the tag"),
        }),
        execute: async ({ tag }) => {
          await navigate({
            to: "/",
            search: { query: `tag:${tag}`, view: "grid" },
          })
          playSound(notificationSound)
          return JSON.stringify({ success: true })
        },
      } satisfies Tool<{ tag: string }>,
      {
        name: "get_templates",
        description: "Get a list of the user's templates.",
        parameters: z.object({}),
        execute: async () => {
          const templates = getTemplates()
          return JSON.stringify({ templates })
        },
      } satisfies Tool<Record<string, never>>,
      {
        name: "get_tags",
        description: "Get a list of the user's tags.",
        parameters: z.object({}),
        execute: async () => {
          const tags = getTags()
          return JSON.stringify({ tags: Object.keys(tags) })
        },
      } satisfies Tool<Record<string, never>>,
      {
        name: "read_clipboard_text",
        description: "Read the text from the user's clipboard.",
        parameters: z.object({}),
        execute: async () => {
          const clipboardText = await navigator.clipboard.readText()
          return JSON.stringify({ clipboardText })
        },
      } satisfies Tool<Record<string, never>>,
      {
        name: "mute_microphone",
        description: "Mute the user's microphone when explicitly requested.",
        parameters: z.object({}),
        execute: async () => {
          sendVoiceConversation("MUTE_MIC")
          playSound(notificationSound)
          return JSON.stringify({ success: true })
        },
      } satisfies Tool<Record<string, never>>,
      {
        name: "unmute_microphone",
        description: "Unmute the user's microphone when explicitly requested.",
        parameters: z.object({}),
        execute: async () => {
          sendVoiceConversation("UNMUTE_MIC")
          playSound(notificationSound)
          return JSON.stringify({ success: true })
        },
      } satisfies Tool<Record<string, never>>,
      {
        name: "end_conversation",
        description: "End the conversation.",
        parameters: z.object({}),
        execute: async () => {
          sendVoiceConversation("END")
        },
      } satisfies Tool<Record<string, never>>,
    ]

    sendVoiceConversation({ type: "ADD_TOOLS", tools })
    return () => {
      sendVoiceConversation({ type: "REMOVE_TOOLS", toolNames: tools.map((tool) => tool.name) })
    }
  }, [navigate, searchNotesRef, getNotes, getTemplates, getTags, sendVoiceConversation])

  // Apply theme
  const themeId = useAtomValue(themeAtom)
  const customThemes = useAtomValue(customThemesAtom)
  React.useEffect(() => {
    import("../utils/themes").then(({ builtInThemes, applyTheme, getAllThemes }) => {
      const allThemes = getAllThemes(customThemes)
      const theme = allThemes.find((t) => t.id === themeId) ?? null
      applyTheme(theme)
    })
  }, [themeId, customThemes])

  // Set the e-paper mode
  const epaper = useAtomValue(epaperAtom)
  React.useEffect(() => {
    document.documentElement.toggleAttribute("data-epaper", epaper)
  }, [epaper])

  // Apply font style
  const defaultFont = useAtomValue(defaultFontAtom)
  React.useEffect(() => {
    // Map "mono" to "monospace" to match CSS variable naming
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

  // Apply overflow classes to parent elements
  React.useEffect(() => {
    if (!rootRef.current) return

    // Get all parent elements
    const parents: HTMLElement[] = []
    let parent = rootRef.current.parentElement
    while (parent) {
      parents.push(parent)
      parent = parent.parentElement
    }

    // Apply classes to all parent elements
    parents.forEach((element) => {
      element.classList.add("overflow-hidden", "overscroll-none", "print:overflow-visible")
    })

    // Clean up when component unmounts
    return () => {
      parents.forEach((element) => {
        element.classList.remove("overflow-hidden", "overscroll-none", "print:overflow-visible")
      })
    }
  }, [rootRef])

  return (
    <div
      ref={rootRef}
      className="flex h-screen w-screen flex-col bg-bg pb-[env(safe-area-inset-bottom)] pl-[env(safe-area-inset-left)] pr-[env(safe-area-inset-right)] print:h-auto print:w-full [@supports(height:100svh)]:h-[100svh]"
      data-vaul-drawer-wrapper=""
    >
      {error ? (
        <div className="flex shrink-0 items-start gap-2 border-b border-border-secondary px-4 py-2 text-text-danger">
          <div className="grid h-6 shrink-0 place-items-center">
            <ErrorIcon16 />
          </div>
          <pre className="whitespace-pre-wrap pt-0.5 font-mono">{error.message}</pre>
        </div>
      ) : null}
      <AppLayout>
        <Outlet />
      </AppLayout>
      <FloatingConversationInput />
      <CommandMenu />
      {/* <Toaster toastOptions={{ duration: 2000 }} /> */}
      <DevBar />
      <UpdateBanner />
    </div>
  )
}
