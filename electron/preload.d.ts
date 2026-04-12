interface ElectronAPI {
  isElectron: true
  openExternal: (url: string) => Promise<void>
  closeWindow: () => Promise<void>
  openInNewWindow: (url: string) => Promise<void>
  quickNoteSave: (payload: { noteId: string; content: string; mode: string }) => Promise<void>
  onQuickNoteSaved: (
    callback: (payload: { noteId: string; content: string; mode: string }) => void,
  ) => () => void
  onMenuAction: (callback: (action: string) => void) => () => void
  onDeepLink: (callback: (path: string) => void) => () => void
  onNavigateTo: (callback: (path: string) => void) => () => void
  fetch: (request: {
    url: string
    method: string
    headers: Record<string, string>
    body?: Uint8Array
  }) => Promise<{
    url: string
    statusCode: number
    statusMessage: string
    headers: Record<string, string>
    body: Uint8Array
  }>
}

interface Window {
  electronAPI?: ElectronAPI
}
