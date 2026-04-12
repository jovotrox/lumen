import { contextBridge, ipcRenderer } from "electron"

contextBridge.exposeInMainWorld("electronAPI", {
  isElectron: true,

  openExternal: (url: string) => ipcRenderer.invoke("electron:open-external", url),

  closeWindow: () => ipcRenderer.invoke("electron:close-window"),

  openInNewWindow: (url: string) => ipcRenderer.invoke("electron:open-in-new-window", url),

  quickNoteSave: (payload: { noteId: string; content: string; mode: string }) =>
    ipcRenderer.invoke("electron:quick-note-save", payload),

  onQuickNoteSaved: (callback: (payload: any) => void) => {
    const handler = (_event: any, payload: any) => callback(payload)
    ipcRenderer.on("quick-note-saved", handler)
    return () => {
      ipcRenderer.removeListener("quick-note-saved", handler)
    }
  },

  onMenuAction: (callback: (action: string) => void) => {
    const handler = (_event: any, action: string) => callback(action)
    ipcRenderer.on("menu-action", handler)
    return () => {
      ipcRenderer.removeListener("menu-action", handler)
    }
  },

  onDeepLink: (callback: (path: string) => void) => {
    const handler = (_event: any, path: string) => callback(path)
    ipcRenderer.on("deep-link", handler)
    return () => {
      ipcRenderer.removeListener("deep-link", handler)
    }
  },

  fetch: (request: {
    url: string
    method: string
    headers: Record<string, string>
    body?: Uint8Array
  }) => ipcRenderer.invoke("electron:fetch", request),
})
