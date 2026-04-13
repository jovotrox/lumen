import {
  app,
  BrowserWindow,
  globalShortcut,
  ipcMain,
  Menu,
  nativeImage,
  net,
  shell,
  Tray,
} from "electron"
import { autoUpdater } from "electron-updater"
import { execFileSync, execSync } from "child_process"
import fs from "fs"
import path from "path"

// ---------------------------------------------------------------------------
// macOS Calendar helper (Swift + EventKit — properly requests permissions)
// ---------------------------------------------------------------------------

const CALENDAR_SWIFT_SRC = `
import EventKit
import Foundation
import CoreImage

let store = EKEventStore()
let dateArg = CommandLine.arguments.count > 1 ? CommandLine.arguments[1] : ""

let semaphore = DispatchSemaphore(value: 0)
var accessGranted = false

if #available(macOS 14.0, *) {
    store.requestFullAccessToEvents { granted, _ in
        accessGranted = granted
        semaphore.signal()
    }
} else {
    store.requestAccess(to: .event) { granted, _ in
        accessGranted = granted
        semaphore.signal()
    }
}
semaphore.wait()

guard accessGranted else {
    print("DENIED")
    exit(0)
}

let df = DateFormatter()
df.dateFormat = "yyyy-MM-dd"
guard let date = df.date(from: dateArg) else {
    print("[]")
    exit(0)
}

let cal = Calendar.current
let startOfDay = cal.startOfDay(for: date)
let endOfDay = cal.date(byAdding: .day, value: 1, to: startOfDay)!

let predicate = store.predicateForEvents(withStart: startOfDay, end: endOfDay, calendars: nil)
let events = store.events(matching: predicate)

var results: [[String: Any]] = []
let isoFmt = ISO8601DateFormatter()

for event in events {
    var colorHex = "#888888"
    if let cgColor = event.calendar.cgColor {
        let ci = CIColor(cgColor: cgColor)
        colorHex = String(format: "#%02X%02X%02X",
            Int(ci.red * 255), Int(ci.green * 255), Int(ci.blue * 255))
    }
    results.append([
        "title": event.title ?? "",
        "start": isoFmt.string(from: event.startDate),
        "end": isoFmt.string(from: event.endDate),
        "calendar": event.calendar.title,
        "color": colorHex,
        "isAllDay": event.isAllDay,
        "location": event.location ?? ""
    ])
}

if let data = try? JSONSerialization.data(withJSONObject: results),
   let json = String(data: data, encoding: .utf8) {
    print(json)
} else {
    print("[]")
}
`

// ---------------------------------------------------------------------------
// URLs
// ---------------------------------------------------------------------------

const PROD_URL = "https://jovotrox.github.io/lumen/"
const DEV_URL = "http://localhost:5173"

function getBaseUrl(): string {
  return app.isPackaged ? PROD_URL : DEV_URL
}

// ---------------------------------------------------------------------------
// Window references
// ---------------------------------------------------------------------------

let mainWindow: BrowserWindow | null = null
let quickNoteWindow: BrowserWindow | null = null
let tray: Tray | null = null
let isQuitting = false

// ---------------------------------------------------------------------------
// Preload path — tsup outputs CJS to electron/dist/
// ---------------------------------------------------------------------------

const preloadPath = path.join(__dirname, "preload.cjs")

// ---------------------------------------------------------------------------
// Window state persistence
// ---------------------------------------------------------------------------

interface WindowState {
  x?: number
  y?: number
  width: number
  height: number
  isMaximized: boolean
}

function getWindowStatePath(): string {
  return path.join(app.getPath("userData"), "window-state.json")
}

function loadWindowState(): WindowState {
  try {
    const data = fs.readFileSync(getWindowStatePath(), "utf-8")
    return JSON.parse(data)
  } catch {
    return { width: 1200, height: 800, isMaximized: false }
  }
}

function saveWindowState(win: BrowserWindow): void {
  if (win.isDestroyed()) return
  const isMaximized = win.isMaximized()
  const bounds = isMaximized ? win.getNormalBounds() : win.getBounds()
  const state: WindowState = { ...bounds, isMaximized }
  try {
    fs.writeFileSync(getWindowStatePath(), JSON.stringify(state))
  } catch {
    // Ignore write errors
  }
}

// ---------------------------------------------------------------------------
// Main window
// ---------------------------------------------------------------------------

function createMainWindow(): void {
  const windowState = loadWindowState()

  mainWindow = new BrowserWindow({
    x: windowState.x,
    y: windowState.y,
    width: windowState.width,
    height: windowState.height,
    minWidth: 800,
    minHeight: 600,
    titleBarStyle: "hiddenInset",
    title: "Lumen Notes",
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      preload: preloadPath,
    },
  })

  if (windowState.isMaximized) {
    mainWindow.maximize()
  }

  // Save window state on resize and move (debounced to avoid excessive writes)
  let saveTimeout: ReturnType<typeof setTimeout> | null = null
  const debouncedSave = () => {
    if (saveTimeout) clearTimeout(saveTimeout)
    saveTimeout = setTimeout(() => saveWindowState(mainWindow!), 500)
  }
  mainWindow.on("resize", debouncedSave)
  mainWindow.on("move", debouncedSave)

  mainWindow.loadURL(getBaseUrl())

  // Prevent Cmd+click from opening a new Electron window.
  // Internal links: extract path and navigate within the SPA via IPC.
  // External links: open in the system browser.
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    const baseUrl = getBaseUrl()
    if (url.startsWith(baseUrl)) {
      const path = "/" + url.slice(baseUrl.length).replace(/^\/+/, "")
      mainWindow?.webContents.send("navigate-to", path)
      return { action: "deny" }
    }
    shell.openExternal(url)
    return { action: "deny" }
  })

  // macOS: hide instead of close
  // On macOS, hide instead of close — unless the user is quitting the app
  mainWindow.on("close", (e) => {
    if (process.platform === "darwin" && !isQuitting) {
      e.preventDefault()
      mainWindow?.hide()
    }
  })

  mainWindow.on("closed", () => {
    mainWindow = null
  })
}

// ---------------------------------------------------------------------------
// Quick-note window
// ---------------------------------------------------------------------------

function createQuickNoteWindow(options: { prewarm?: boolean } = {}): void {
  // Reuse existing window if it's still open — instant re-invoke
  if (quickNoteWindow && !quickNoteWindow.isDestroyed()) {
    quickNoteWindow.webContents.send("quick-note-reset")
    quickNoteWindow.show()
    quickNoteWindow.focus()
    return
  }

  const baseUrl = getBaseUrl()
  // Append /quick-note route — handle trailing slash in base
  const quickNoteUrl = baseUrl.endsWith("/") ? `${baseUrl}quick-note` : `${baseUrl}/quick-note`

  quickNoteWindow = new BrowserWindow({
    width: 420,
    height: 320,
    center: true,
    alwaysOnTop: true,
    resizable: true,
    minimizable: false,
    maximizable: false,
    titleBarStyle: "hiddenInset",
    title: "Quick Note",
    backgroundColor: "#0a0a0a",
    show: false,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      preload: preloadPath,
    },
  })

  quickNoteWindow.loadURL(quickNoteUrl)

  // Only show once content is ready — prevents white flash
  quickNoteWindow.once("ready-to-show", () => {
    if (!options.prewarm) {
      quickNoteWindow?.show()
      quickNoteWindow?.focus()
    }
  })

  // Hide instead of close — keeps React mounted for instant re-invoke
  quickNoteWindow.on("close", (e) => {
    if (!isQuitting) {
      e.preventDefault()
      quickNoteWindow?.hide()
    }
  })

  quickNoteWindow.on("closed", () => {
    quickNoteWindow = null
  })
}

// ---------------------------------------------------------------------------
// Show main window (for tray / dock reopen)
// ---------------------------------------------------------------------------

function showMainWindow(): void {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.show()
    mainWindow.focus()
  } else {
    createMainWindow()
  }
}

// ---------------------------------------------------------------------------
// System tray
// ---------------------------------------------------------------------------

function createTray(): void {
  // Use "Template" naming convention — macOS auto-picks @2x for Retina
  // and handles light/dark mode automatically for template images
  const iconPath = path.join(__dirname, "..", "icons", "trayTemplate.png")
  const icon = nativeImage.createFromPath(iconPath)

  tray = new Tray(icon)
  tray.setToolTip("Lumen")

  const contextMenu = Menu.buildFromTemplate([
    { label: "Show Lumen", click: showMainWindow },
    { label: "Quick Note (\u2325\u21e7N)", click: () => createQuickNoteWindow() },
    { type: "separator" },
    {
      label: "Quit Lumen",
      click: () => {
        app.exit(0)
      },
    },
  ])

  tray.setContextMenu(contextMenu)
}

// ---------------------------------------------------------------------------
// IPC handlers
// ---------------------------------------------------------------------------

function registerIpcHandlers(): void {
  ipcMain.handle("electron:open-external", async (_event, url: string) => {
    // Only allow http/https URLs to prevent file:// and protocol handler abuse
    try {
      const parsed = new URL(url)
      if (parsed.protocol === "https:" || parsed.protocol === "http:") {
        await shell.openExternal(url)
      }
    } catch {
      // Invalid URL, ignore
    }
  })

  ipcMain.handle("electron:close-window", (event) => {
    const win = BrowserWindow.fromWebContents(event.sender)
    if (win) {
      win.close()
    }
  })

  ipcMain.handle(
    "electron:quick-note-save",
    async (_event, payload: { noteId: string; content: string; mode: string }) => {
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send("quick-note-saved", payload)
      }
    },
  )

  ipcMain.handle("electron:open-in-new-window", (_event, noteUrl: string) => {
    // Only allow URLs matching our app's base URL
    const baseUrl = getBaseUrl()
    if (!noteUrl.startsWith(baseUrl)) return

    const win = new BrowserWindow({
      width: 900,
      height: 700,
      minWidth: 600,
      minHeight: 400,
      titleBarStyle: "hiddenInset",
      title: "Lumen Notes",
      webPreferences: {
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: true,
        preload: preloadPath,
      },
    })
    win.loadURL(noteUrl)
  })

  ipcMain.handle("electron:get-calendar-events", async (_event, dateString: string) => {
    if (process.platform !== "darwin") return { denied: false, events: [] }

    // Validate date format to prevent command injection
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateString)) {
      return { denied: false, events: [] }
    }

    try {
      const binaryPath = path.join(app.getPath("userData"), "lumen-calendar-helper")

      // Compile the Swift EventKit helper once, cache the binary
      if (!fs.existsSync(binaryPath)) {
        const srcPath = path.join(app.getPath("temp"), "lumen-calendar-helper.swift")
        fs.writeFileSync(srcPath, CALENDAR_SWIFT_SRC)
        execSync(
          `swiftc "${srcPath}" -o "${binaryPath}" -framework EventKit -framework CoreImage`,
          { timeout: 30000 },
        )
      }

      // Use execFileSync to avoid shell interpretation entirely
      const result = execFileSync(binaryPath, [dateString], {
        timeout: 10000,
        encoding: "utf-8",
      })

      const trimmed = result.trim()
      if (trimmed === "DENIED") {
        return { denied: true, events: [] }
      }
      return { denied: false, events: JSON.parse(trimmed || "[]") }
    } catch (error) {
      console.error("Failed to fetch calendar events:", error)
      return { denied: true, events: [] }
    }
  })

  ipcMain.handle(
    "electron:fetch",
    async (
      _event,
      request: {
        url: string
        method: string
        headers: Record<string, string>
        body?: Uint8Array
      },
    ) => {
      const { url, method, headers, body } = request

      const response = await net.fetch(url, {
        method,
        headers,
        body: body ? Buffer.from(body) : undefined,
      })

      const responseHeaders: Record<string, string> = {}
      response.headers.forEach((value, key) => {
        responseHeaders[key] = value
      })

      const arrayBuffer = await response.arrayBuffer()
      const responseBody = new Uint8Array(arrayBuffer)

      return {
        url: response.url,
        statusCode: response.status,
        statusMessage: response.statusText,
        headers: responseHeaders,
        body: responseBody,
      }
    },
  )
}

// ---------------------------------------------------------------------------
// Application menu
// ---------------------------------------------------------------------------

function createAppMenu(): void {
  const isMac = process.platform === "darwin"

  const template: Electron.MenuItemConstructorOptions[] = [
    // macOS app menu
    ...(isMac
      ? [
          {
            label: app.name,
            submenu: [
              { role: "about" as const },
              { type: "separator" as const },
              {
                label: "Settings...",
                accelerator: "CmdOrCtrl+,",
                click: () => sendMenuAction("navigate:/settings"),
              },
              { type: "separator" as const },
              { role: "hide" as const },
              { role: "hideOthers" as const },
              { role: "unhide" as const },
              { type: "separator" as const },
              { role: "quit" as const },
            ],
          },
        ]
      : []),

    // File
    {
      label: "File",
      submenu: [
        {
          label: "New Note",
          accelerator: "CmdOrCtrl+Shift+O",
          click: () => sendMenuAction("new-note"),
        },
        { label: "Quick Note", accelerator: "Alt+Shift+N", click: () => createQuickNoteWindow() },
        {
          label: "Open Note in New Window",
          click: () => sendMenuAction("open-in-new-window"),
        },
        { type: "separator" },
        { label: "Save", accelerator: "CmdOrCtrl+S", click: () => sendMenuAction("save") },
        { type: "separator" },
        isMac ? { role: "close" } : { role: "quit" },
      ],
    },

    // Edit
    {
      label: "Edit",
      submenu: [
        { role: "undo" },
        { role: "redo" },
        { type: "separator" },
        { role: "cut" },
        { role: "copy" },
        { role: "paste" },
        { role: "selectAll" },
        { type: "separator" },
        {
          label: "Find...",
          accelerator: "CmdOrCtrl+F",
          click: () => sendMenuAction("find"),
        },
        { type: "separator" },
        {
          label: "Toggle Read/Write Mode",
          accelerator: "CmdOrCtrl+E",
          click: () => sendMenuAction("toggle-mode"),
        },
      ],
    },

    // Format — these shortcuts are handled by CodeMirror, menu just shows them
    {
      label: "Format",
      submenu: [
        {
          label: "Bold",
          accelerator: "CmdOrCtrl+B",
          registerAccelerator: false,
          click: () => sendMenuAction("format:bold"),
        },
        {
          label: "Italic",
          accelerator: "CmdOrCtrl+I",
          registerAccelerator: false,
          click: () => sendMenuAction("format:italic"),
        },
        {
          label: "Strikethrough",
          accelerator: "CmdOrCtrl+Shift+X",
          registerAccelerator: false,
          click: () => sendMenuAction("format:strikethrough"),
        },
        {
          label: "Code",
          accelerator: "CmdOrCtrl+Shift+M",
          registerAccelerator: false,
          click: () => sendMenuAction("format:code"),
        },
        { type: "separator" },
        {
          label: "Heading",
          accelerator: "CmdOrCtrl+Shift+H",
          registerAccelerator: false,
          click: () => sendMenuAction("format:heading"),
        },
        {
          label: "Blockquote",
          accelerator: "CmdOrCtrl+Shift+B",
          registerAccelerator: false,
          click: () => sendMenuAction("format:blockquote"),
        },
        { type: "separator" },
        {
          label: "Bullet List",
          accelerator: "CmdOrCtrl+Shift+8",
          registerAccelerator: false,
          click: () => sendMenuAction("format:bullet-list"),
        },
        {
          label: "Numbered List",
          accelerator: "CmdOrCtrl+Shift+7",
          registerAccelerator: false,
          click: () => sendMenuAction("format:numbered-list"),
        },
        {
          label: "Task List",
          accelerator: "CmdOrCtrl+Shift+T",
          registerAccelerator: false,
          click: () => sendMenuAction("format:task-list"),
        },
        { type: "separator" },
        {
          label: "Insert Link",
          accelerator: "CmdOrCtrl+K",
          registerAccelerator: false,
          click: () => sendMenuAction("format:link"),
        },
      ],
    },

    // View
    {
      label: "View",
      submenu: [
        {
          label: "Toggle Sidebar",
          accelerator: "CmdOrCtrl+Shift+S",
          click: () => sendMenuAction("toggle-sidebar"),
        },
        {
          label: "Toggle Help",
          accelerator: "CmdOrCtrl+/",
          click: () => sendMenuAction("toggle-help"),
        },
        { type: "separator" },
        { role: "resetZoom" },
        { role: "zoomIn" },
        { role: "zoomOut" },
        { type: "separator" },
        { role: "toggleDevTools" },
      ],
    },

    // Go
    {
      label: "Go",
      submenu: [
        { label: "Home", click: () => sendMenuAction("navigate:/") },
        { label: "Inbox", click: () => sendMenuAction("navigate:/inbox") },
        { label: "Notes", click: () => sendMenuAction("navigate:/notes") },
        { label: "Projects", click: () => sendMenuAction("navigate:/projects") },
        { label: "Tasks", click: () => sendMenuAction("navigate:/tasks") },
        { label: "People", click: () => sendMenuAction("navigate:/people") },
        { label: "Tags", click: () => sendMenuAction("navigate:/tags") },
        { type: "separator" },
        { label: "Settings", click: () => sendMenuAction("navigate:/settings") },
        { type: "separator" },
        {
          label: "Back",
          accelerator: "CmdOrCtrl+[",
          click: () => sendMenuAction("go-back"),
        },
        {
          label: "Forward",
          accelerator: "CmdOrCtrl+]",
          click: () => sendMenuAction("go-forward"),
        },
      ],
    },

    // Window
    {
      label: "Window",
      submenu: [
        { role: "minimize" },
        { role: "zoom" },
        ...(isMac ? [{ type: "separator" as const }, { role: "front" as const }] : []),
      ],
    },

    // Help
    {
      label: "Help",
      submenu: [
        {
          label: "Lumen Help",
          click: () => {
            shell.openExternal("https://github.com/jovotrox/lumen")
          },
        },
      ],
    },
  ]

  const menu = Menu.buildFromTemplate(template)
  Menu.setApplicationMenu(menu)
}

function sendMenuAction(action: string): void {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send("menu-action", action)
  }
}

// ---------------------------------------------------------------------------
// Auto-updater (electron-updater)
// ---------------------------------------------------------------------------

function setupAutoUpdater(): void {
  // Only check for updates in production
  if (!app.isPackaged) return

  autoUpdater.autoDownload = true
  autoUpdater.autoInstallOnAppQuit = true

  autoUpdater.on("error", (error) => {
    console.error("Auto-updater error:", error)
  })

  autoUpdater.on("update-available", () => {
    console.log("Update available, downloading...")
  })

  autoUpdater.on("update-downloaded", () => {
    console.log("Update downloaded, will install on quit")
  })

  // Check on startup and every 4 hours
  autoUpdater.checkForUpdatesAndNotify()
  setInterval(
    () => {
      autoUpdater.checkForUpdatesAndNotify()
    },
    4 * 60 * 60 * 1000,
  )
}

// ---------------------------------------------------------------------------
// Deep link handler (lumen:// protocol)
// ---------------------------------------------------------------------------

function handleDeepLink(url: string): void {
  try {
    const parsed = new URL(url)
    // lumen://note/my-note-id → /notes/my-note-id
    // lumen://inbox → /inbox
    // lumen://settings → /settings
    const path = parsed.pathname.replace(/^\/\//, "/")
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send("deep-link", path)
      showMainWindow()
    }
  } catch (error) {
    console.error("Invalid deep link URL:", error)
  }
}

// ---------------------------------------------------------------------------
// App lifecycle
// ---------------------------------------------------------------------------

// Register lumen:// protocol handler
app.setAsDefaultProtocolClient("lumen")

// macOS: handle lumen:// URLs when app is already running
app.on("open-url", (event, url) => {
  event.preventDefault()
  handleDeepLink(url)
})

// Single-instance lock — if a second instance launches, focus the existing one
const gotTheLock = app.requestSingleInstanceLock()
if (!gotTheLock) {
  app.quit()
} else {
  app.on("second-instance", (_event, argv) => {
    showMainWindow()
    // On Windows/Linux, the deep link URL is in argv
    const url = argv.find((arg) => arg.startsWith("lumen://"))
    if (url) handleDeepLink(url)
  })

  app.whenReady().then(() => {
    // Only override dock icon in dev — packaged app uses .icns from bundle (has rounded corners mask)
    app.setName("Lumen")
    if (process.platform === "darwin" && !app.isPackaged) {
      const dockIcon = nativeImage.createFromPath(path.join(__dirname, "..", "icons", "icon.png"))
      app.dock.setIcon(dockIcon)
    }

    registerIpcHandlers()
    createMainWindow()
    createAppMenu()
    createTray()

    // Global shortcut: Alt+Shift+N → Quick Note
    globalShortcut.register("Alt+Shift+N", () => createQuickNoteWindow())

    // Pre-warm Quick Note window so first invocation is instant (no white flash, no React bootstrap delay)
    setTimeout(() => {
      if (!quickNoteWindow) createQuickNoteWindow({ prewarm: true })
    }, 2000)

    // macOS: re-create window when clicking dock icon with no windows visible
    app.on("activate", () => {
      showMainWindow()
    })

    setupAutoUpdater()
  })

  // Mark as quitting so the main window's "close" handler can actually close
  app.on("before-quit", () => {
    isQuitting = true
  })

  // macOS: do NOT quit when all windows are closed (app lives in tray)
  app.on("window-all-closed", () => {
    if (process.platform !== "darwin") {
      app.quit()
    }
  })

  // Clean up global shortcut on quit
  app.on("will-quit", () => {
    globalShortcut.unregisterAll()
  })
}
