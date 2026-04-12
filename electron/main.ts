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
import path from "path"

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

// ---------------------------------------------------------------------------
// Preload path — tsup outputs CJS to electron/dist/
// ---------------------------------------------------------------------------

const preloadPath = path.join(__dirname, "preload.cjs")

// ---------------------------------------------------------------------------
// Main window
// ---------------------------------------------------------------------------

function createMainWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
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

  mainWindow.loadURL(getBaseUrl())

  // macOS: hide instead of close
  mainWindow.on("close", (e) => {
    if (process.platform === "darwin") {
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

function createQuickNoteWindow(): void {
  // Reuse existing window if it's still open
  if (quickNoteWindow && !quickNoteWindow.isDestroyed()) {
    quickNoteWindow.show()
    quickNoteWindow.focus()
    return
  }

  const baseUrl = getBaseUrl()
  // Append /quick-note route — handle trailing slash in base
  const quickNoteUrl = baseUrl.endsWith("/") ? `${baseUrl}quick-note` : `${baseUrl}/quick-note`

  quickNoteWindow = new BrowserWindow({
    width: 400,
    height: 300,
    center: true,
    alwaysOnTop: true,
    resizable: true,
    minimizable: false,
    maximizable: false,
    title: "Quick Note",
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      preload: preloadPath,
    },
  })

  quickNoteWindow.loadURL(quickNoteUrl)

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
  const iconPath = path.join(__dirname, "..", "icons", "icon.png")
  const icon = nativeImage.createFromPath(iconPath).resize({ width: 16, height: 16 })
  // Mark as template so macOS renders it correctly in light/dark mode
  icon.setTemplateImage(true)

  tray = new Tray(icon)
  tray.setToolTip("Lumen")

  const contextMenu = Menu.buildFromTemplate([
    { label: "Show Lumen", click: showMainWindow },
    { label: "Quick Note (\u2325\u21e7N)", click: createQuickNoteWindow },
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
    await shell.openExternal(url)
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
    registerIpcHandlers()
    createMainWindow()
    createAppMenu()
    createTray()

    // Global shortcut: Alt+Shift+N → Quick Note
    globalShortcut.register("Alt+Shift+N", createQuickNoteWindow)

    // macOS: re-create window when clicking dock icon with no windows visible
    app.on("activate", () => {
      showMainWindow()
    })

    setupAutoUpdater()
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
