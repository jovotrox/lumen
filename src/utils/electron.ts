/**
 * Electron platform detection and utilities
 */

export function isElectron(): boolean {
  return typeof window !== "undefined" && "electronAPI" in window
}

/**
 * Create an HTTP client for isomorphic-git that works in Electron (no CORS).
 * Follows the same interface as createTauriHttpClient() in tauri.ts.
 */
export function createElectronHttpClient() {
  return {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    async request(request: any) {
      const { url, method = "GET", headers = {}, body } = request

      // Collect body chunks if present (isomorphic-git sends body as async iterator)
      let bodyData: Uint8Array | undefined
      if (body) {
        const chunks: Uint8Array[] = []
        for await (const chunk of body) {
          chunks.push(chunk)
        }
        const totalLength = chunks.reduce((sum, chunk) => sum + chunk.length, 0)
        bodyData = new Uint8Array(totalLength)
        let offset = 0
        for (const chunk of chunks) {
          bodyData.set(chunk, offset)
          offset += chunk.length
        }
      }

      const requestHeaders: Record<string, string> = {
        "User-Agent": "git/isomorphic-git@1.0.0",
        ...headers,
      }

      const response = await window.electronAPI!.fetch({
        url,
        method,
        headers: requestHeaders,
        body: bodyData,
      })

      return {
        url: response.url,
        method,
        statusCode: response.statusCode,
        statusMessage: response.statusMessage,
        body: [new Uint8Array(response.body)],
        headers: response.headers,
      }
    },
  }
}

/**
 * Fetch wrapper that uses Electron IPC for CORS-free requests.
 * Used by git-lfs.ts for direct GitHub LFS API calls.
 */
export async function electronFetch(
  url: string,
  init?: { method?: string; headers?: Record<string, string>; body?: string | ArrayBuffer },
): Promise<Response> {
  const method = init?.method ?? "GET"
  const headers = (init?.headers ?? {}) as Record<string, string>

  let bodyData: Uint8Array | undefined
  if (init?.body) {
    if (typeof init.body === "string") {
      bodyData = new TextEncoder().encode(init.body)
    } else {
      bodyData = new Uint8Array(init.body)
    }
  }

  const result = await window.electronAPI!.fetch({ url, method, headers, body: bodyData })

  // Construct a standard Response object so existing code works seamlessly
  const body = result.body.buffer.slice(
    result.body.byteOffset,
    result.body.byteOffset + result.body.byteLength,
  ) as ArrayBuffer
  return new Response(body, {
    status: result.statusCode,
    statusText: result.statusMessage,
    headers: result.headers,
  })
}
