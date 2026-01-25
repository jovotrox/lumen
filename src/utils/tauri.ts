/**
 * Tauri platform detection and utilities
 */

/**
 * Check if running inside Tauri app
 */
export function isTauri(): boolean {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window
}

/**
 * Open URL in system browser (works in both browser and Tauri)
 */
export async function openExternal(url: string): Promise<void> {
  if (isTauri()) {
    const { open } = await import("@tauri-apps/plugin-shell")
    await open(url)
  } else {
    window.open(url, "_blank", "noopener,noreferrer")
  }
}

/**
 * Create an HTTP client for isomorphic-git that works in Tauri (no CORS)
 * This follows the isomorphic-git HttpClient interface
 */
export function createTauriHttpClient() {
  return {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    async request(request: any) {
      const { url, method = "GET", headers = {}, body } = request
      const { fetch: tauriFetch } = await import("@tauri-apps/plugin-http")

      // Collect body chunks if present (isomorphic-git sends body as async iterator)
      let bodyData: Uint8Array | undefined
      if (body) {
        const chunks: Uint8Array[] = []
        for await (const chunk of body) {
          chunks.push(chunk)
        }
        // Concatenate all chunks
        const totalLength = chunks.reduce((sum, chunk) => sum + chunk.length, 0)
        bodyData = new Uint8Array(totalLength)
        let offset = 0
        for (const chunk of chunks) {
          bodyData.set(chunk, offset)
          offset += chunk.length
        }
      }

      // Add required headers for Git protocol
      const requestHeaders: Record<string, string> = {
        "User-Agent": "git/isomorphic-git@1.0.0",
        ...headers,
      }

      const response = await tauriFetch(url, {
        method,
        headers: requestHeaders,
        body: bodyData ? new Blob([bodyData.buffer as ArrayBuffer]) : undefined,
      })

      const responseBody = new Uint8Array(await response.arrayBuffer())

      // Convert headers to the format isomorphic-git expects
      const responseHeaders: Record<string, string> = {}
      response.headers.forEach((value, key) => {
        responseHeaders[key] = value
      })

      return {
        url: response.url,
        method,
        statusCode: response.status,
        statusMessage: response.statusText,
        body: [responseBody],
        headers: responseHeaders,
      }
    },
  }
}
