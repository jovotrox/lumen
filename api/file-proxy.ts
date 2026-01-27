/**
 * This function proxies a file from a given URL and returns it directly.
 * The URL should be provided as a query parameter, e.g. /file-proxy?url=https://example.com/image.jpg
 */

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, HEAD, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "Access-Control-Max-Age": "86400",
}

async function handler(request: Request): Promise<Response> {
  // Handle CORS preflight
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: CORS_HEADERS })
  }

  try {
    const url = getRequestUrl(request)
    const fileUrl = url.searchParams.get("url")

    if (!fileUrl) {
      return new Response("Missing 'url' query parameter", { status: 400, headers: CORS_HEADERS })
    }

    const method = request.method === "HEAD" ? "HEAD" : "GET"
    const response = await fetch(fileUrl, { method })

    if (!response.ok) {
      return new Response(`Failed to fetch file: ${response.statusText}`, {
        status: response.status,
        headers: CORS_HEADERS,
      })
    }

    const contentType = response.headers.get("content-type") || "application/octet-stream"

    return new Response(method === "HEAD" ? null : response.body, {
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=3600",
        "Access-Control-Allow-Origin": "*",
      },
    })
  } catch (error) {
    console.error(error)
    const message = error instanceof Error ? error.message : "Unknown error"
    return new Response(`Error: ${message}`, { status: 500, headers: CORS_HEADERS })
  }
}

export const GET = handler
export const HEAD = handler
export const OPTIONS = handler

function getRequestUrl(request: Request): URL {
  try {
    return new URL(request.url)
  } catch {
    const host = request.headers.get("host") ?? "localhost"
    const proto = request.headers.get("x-forwarded-proto") ?? "http"
    return new URL(request.url, `${proto}://${host}`)
  }
}
