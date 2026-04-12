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
// Preload path — tsup outputs CJS to electron/dist/, so __dirname works.
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
// App lifecycle
// ---------------------------------------------------------------------------

// Single-instance lock — if a second instance launches, focus the existing one
const gotTheLock = app.requestSingleInstanceLock()
if (!gotTheLock) {
  app.quit()
} else {
  app.on("second-instance", () => {
    showMainWindow()
  })

  app.whenReady().then(() => {
    registerIpcHandlers()
    createMainWindow()
    createTray()

    // Global shortcut: Alt+Shift+N → Quick Note
    globalShortcut.register("Alt+Shift+N", createQuickNoteWindow)

    // macOS: re-create window when clicking dock icon with no windows visible
    app.on("activate", () => {
      showMainWindow()
    })
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
