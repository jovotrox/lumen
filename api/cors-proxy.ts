// Reference: https://github.com/isomorphic-git/cors-proxy

// CORS headers for cross-origin requests (GitHub Pages → Vercel API)
function addCorsHeaders(headers: Headers, request: Request): Headers {
  const origin = request.headers.get("origin") || "*"
  headers.set("Access-Control-Allow-Origin", origin)
  headers.set("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS, HEAD")
  headers.set("Access-Control-Allow-Headers", ALLOW_HEADERS.join(", "))
  headers.set("Access-Control-Expose-Headers", EXPOSE_HEADERS.join(", "))
  headers.set("Access-Control-Max-Age", "86400")
  return headers
}

const ALLOW_HEADERS = [
  "accept-encoding",
  "accept-language",
  "accept",
  "access-control-allow-origin",
  "authorization",
  "cache-control",
  "connection",
  "content-length",
  "content-type",
  "dnt",
  "git-protocol",
  "pragma",
  "range",
  "referer",
  "user-agent",
  "x-authorization",
  "x-http-method-override",
  "x-requested-with",
]

const EXPOSE_HEADERS = [
  "accept-ranges",
  "age",
  "cache-control",
  "content-length",
  "content-language",
  "content-type",
  "date",
  "etag",
  "expires",
  "last-modified",
  "location",
  "pragma",
  "server",
  "transfer-encoding",
  "vary",
  "x-github-request-id",
  "x-redirected-url",
]

async function handler(request: Request): Promise<Response> {
  // Handle CORS preflight requests
  if (request.method === "OPTIONS") {
    const headers = new Headers()
    addCorsHeaders(headers, request)
    return new Response(null, { status: 204, headers })
  }

  try {
    const url = getRequestUrl(request)
    const path = url.searchParams.get("path")

    if (!path) {
      const headers = new Headers()
      addCorsHeaders(headers, request)
      return new Response("Missing 'path' query parameter", { status: 400, headers })
    }

    const targetUrl = new URL(`https://${path}`)
    url.searchParams.delete("path")
    const remainingQuery = url.searchParams.toString()
    if (remainingQuery) {
      targetUrl.search = remainingQuery
    }

    const requestHeaders = new Headers()
    for (const [key, value] of request.headers.entries()) {
      if (ALLOW_HEADERS.includes(key.toLowerCase())) {
        requestHeaders.set(key, value)
      }
    }

    // GitHub requests behave differently if the user-agent starts with "git/"
    requestHeaders.set("user-agent", "git/lumen/cors-proxy")

    const fetchOptions: RequestInit & { duplex?: "half" } = {
      method: request.method,
      headers: requestHeaders,
    }

    if (request.body) {
      fetchOptions.body = request.body
      fetchOptions.duplex = "half"
    }

    const response = await fetch(targetUrl, fetchOptions)

    const responseHeaders = new Headers()
    for (const [key, value] of response.headers.entries()) {
      if (EXPOSE_HEADERS.includes(key.toLowerCase())) {
        responseHeaders.set(key, value)
      }
    }

    // Add CORS headers to the response
    addCorsHeaders(responseHeaders, request)

    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: responseHeaders,
    })
  } catch (error) {
    console.error(error)
    const message = error instanceof Error ? error.message : "Unknown error"
    const headers = new Headers()
    addCorsHeaders(headers, request)
    return new Response(`Error: ${message}`, { status: 500, headers })
  }
}

export const GET = handler
export const POST = handler
export const PUT = handler
export const PATCH = handler
export const DELETE = handler
export const OPTIONS = handler
export const HEAD = handler

function getRequestUrl(request: Request): URL {
  try {
    return new URL(request.url)
  } catch {
    const host = request.headers.get("host") ?? "localhost"
    const proto = request.headers.get("x-forwarded-proto") ?? "http"
    return new URL(request.url, `${proto}://${host}`)
  }
}
