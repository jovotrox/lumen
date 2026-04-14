import { createFileRoute, Outlet, useNavigate, useRouter } from "@tanstack/react-router"
import { useAtom, useAtomValue, useSetAtom } from "jotai"
import { selectAtom, useAtomCallback } from "jotai/utils"
import React from "react"
import { useHotkeys } from "react-hotkeys-hook"
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
import { useTabs } from "../hooks/use-tabs"
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

  // Single useTabs() for the whole component — avoids multiple hook instances
  // each creating their own atom subscriptions.
  const { openTab, updateActiveTab } = useTabs()

  // Cmd+T — create a new note in a NEW tab (desktop-style shortcut).
  // We call openTab + navigate so the new note always gets its own tab
  // with a fresh breadcrumb trail.
  useHotkeys(
    "mod+t",
    (e) => {
      e.preventDefault()
      const newId = generateNoteId()
      const path = `/notes/${newId}`
      openTab(path, newId, "note")
      navigate({
        to: "/notes/$",
        params: { _splat: newId },
        search: { mode: "write", query: undefined, view: "grid" },
      })
    },
    {
      preventDefault: true,
      enableOnFormTags: true,
      enableOnContentEditable: true,
    },
  )

  // Cmd+, to open Settings (native macOS convention)
  useHotkeys(
    "mod+comma",
    (e) => {
      e.preventDefault()
      navigate({ to: "/settings", search: { query: undefined } })
    },
    {
      preventDefault: true,
      enableOnFormTags: true,
      enableOnContentEditable: true,
    },
  )

  // Update active tab when navigating to non-note routes
  React.useEffect(() => {
    const unsubscribe = router.subscribe("onResolved", ({ toLocation }) => {
      const path = toLocation.pathname.replace(/^\/lumen/, "").replace(/\/$/, "") || "/"

      // Skip note routes — they handle their own tab updates in _appRoot.notes_.$.tsx
      if (path.match(/^\/notes\/.+/)) return

      // Map known routes to tab titles and icons
      const routeMap: Record<
        string,
        { title: string; icon: NonNullable<import("../global-state").Tab["icon"]> }
      > = {
        "/": { title: "Home", icon: "home" },
        "/inbox": { title: "Inbox", icon: "inbox" },
        "/notes": { title: "Notes", icon: "note" },
        "/projects": { title: "Projects", icon: "project" },
        "/tasks": { title: "Tasks", icon: "tasks" },
        "/links": { title: "Links", icon: "links" },
        "/people": { title: "People", icon: "people" },
        "/tags": { title: "Tags", icon: "tags" },
        "/settings": { title: "Settings", icon: "settings" },
      }

      const route = routeMap[path]
      if (route) {
        updateActiveTab(path, route.title, route.icon)
      }
    })

    return unsubscribe
  }, [router, updateActiveTab])

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

  // Listen for deep link navigation from Electron (lumen:// protocol)
  React.useEffect(() => {
    if (!isElectron()) return

    const unlisten = window.electronAPI!.onDeepLink((path) => {
      router.navigate({ to: path })
    })

    return unlisten
  }, [router])

  // Listen for Cmd+click internal navigation from Electron main process
  // This opens the link in a NEW tab (explicit new tab action)
  React.useEffect(() => {
    if (!isElectron()) return

    const unlisten = window.electronAPI!.onNavigateTo((rawPath) => {
      // Strip query params and base path for clean tab path
      const normalized =
        rawPath
          .replace(/\?.*$/, "")
          .replace(/^\/lumen/, "")
          .replace(/\/$/, "") || "/"
      const noteMatch = normalized.match(/^\/notes\/(.+)/)
      const title = noteMatch ? noteMatch[1] : normalized.replace(/^\//, "") || "Home"
      openTab(normalized, title)
      router.navigate({ to: normalized })
    })

    return unlisten
  }, [router, openTab])

  // Listen for menu actions from Electron main process
  React.useEffect(() => {
    if (!isElectron()) return

    const unlisten = window.electronAPI!.onMenuAction((action) => {
      if (action.startsWith("navigate:")) {
        const path = action.replace("navigate:", "")
        router.navigate({ to: path })
      } else {
        switch (action) {
          case "new-note":
            // Trigger new note creation — same as Cmd+Shift+O
            router.navigate({
              to: "/notes/$",
              params: { _splat: generateNoteId() },
              search: { mode: "write", query: undefined, view: "grid" },
            })
            break
          case "save":
            // Dispatch a keyboard event so CodeMirror/React handlers pick it up
            document.dispatchEvent(new KeyboardEvent("keydown", { key: "s", metaKey: true }))
            break
          case "toggle-mode":
            document.dispatchEvent(new KeyboardEvent("keydown", { key: "e", metaKey: true }))
            break
          case "toggle-sidebar":
            document.dispatchEvent(
              new KeyboardEvent("keydown", { key: "S", metaKey: true, shiftKey: true }),
            )
            break
          case "toggle-help":
            document.dispatchEvent(new KeyboardEvent("keydown", { key: "/", metaKey: true }))
            break
          case "find":
            document.dispatchEvent(new KeyboardEvent("keydown", { key: "f", metaKey: true }))
            break
          case "go-back":
            router.history.back()
            break
          case "go-forward":
            router.history.forward()
            break
          // Format actions — dispatch keyboard events for CodeMirror
          default:
            if (action.startsWith("format:")) {
              // These are handled by CodeMirror's keymap, let them pass through
            }
            break
        }
      }
    })

    return unlisten
  }, [router])

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
            to: "/tags/$",
            params: { _splat: tag },
            search: { query: undefined, view: "grid" },
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
