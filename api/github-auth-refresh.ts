// Proxy for GitHub's OAuth refresh_token endpoint. We need this because
// the web OAuth flow requires `client_secret` to refresh, and we don't ship
// the secret to the browser. Only the Vercel function has it.
//
// Electron + Tauri call GitHub directly (Device Flow refresh doesn't need
// a secret) and bypass this endpoint.

type RefreshResponseBody = {
  access_token?: string
  refresh_token?: string
  expires_in?: number
  error?: string
  error_description?: string
}

function corsHeaders(request: Request): HeadersInit {
  const origin = request.headers.get("origin") || "*"
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Accept",
    "Access-Control-Max-Age": "86400",
  }
}

export async function OPTIONS(request: Request): Promise<Response> {
  return new Response(null, { status: 204, headers: corsHeaders(request) })
}

export async function POST(request: Request): Promise<Response> {
  try {
    const { refresh_token } = (await request.json()) as { refresh_token?: string }
    if (!refresh_token || typeof refresh_token !== "string") {
      return new Response(JSON.stringify({ error: "missing refresh_token" }), {
        status: 400,
        headers: { "Content-Type": "application/json", ...corsHeaders(request) },
      })
    }

    const githubResponse = await fetch("https://github.com/login/oauth/access_token", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        client_id: process.env.VITE_GITHUB_CLIENT_ID,
        client_secret: process.env.GITHUB_CLIENT_SECRET,
        grant_type: "refresh_token",
        refresh_token,
      }),
    })

    const data = (await githubResponse.json()) as RefreshResponseBody

    // Forward GitHub's response (including errors) so the client can log it.
    // We don't distinguish success/error at this layer — the client decides.
    return new Response(JSON.stringify(data), {
      status: githubResponse.status,
      headers: { "Content-Type": "application/json", ...corsHeaders(request) },
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error"
    return new Response(JSON.stringify({ error: "internal", error_description: message }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...corsHeaders(request) },
    })
  }
}
