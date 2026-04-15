/**
 * Exchanges a GitHub OAuth refresh_token for a fresh access_token.
 *
 * Required when the OAuth app has "Expire user authorization tokens" enabled
 * (default for OAuth apps created after late 2022) — without this, access
 * tokens die after 8h and users have to sign out + sign in manually.
 *
 * Two code paths:
 *
 *   - **Electron/Tauri** (Device Flow): calls GitHub's token endpoint
 *     directly via `electronFetch`. Device Flow refresh doesn't require
 *     `client_secret`, just `client_id + refresh_token`.
 *
 *   - **Web PWA** (web OAuth): GitHub requires `client_secret` on web flow
 *     refresh, and we can't ship that secret to the browser. So we proxy
 *     through `/api/github-auth-refresh` which holds the secret server-side.
 */

import { logDebug } from "./debug-log"
import { electronFetch, isElectron } from "./electron"

const GITHUB_CLIENT_ID = import.meta.env.VITE_GITHUB_CLIENT_ID
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || ""

export type RefreshResult = {
  accessToken: string
  refreshToken: string
  /** Epoch ms when the new accessToken will expire, if GitHub told us. */
  expiresAt?: number
}

type TokenResponseBody = {
  access_token?: string
  refresh_token?: string
  expires_in?: number
  error?: string
  error_description?: string
}

/**
 * All environments can refresh now — Electron hits GitHub directly, web PWA
 * hits our Vercel function. Tauri falls back to direct fetch (browser fetch
 * to github.com works because GitHub sets CORS headers on the OAuth endpoint).
 */
export function canRefreshTokens(): boolean {
  return true
}

export async function refreshAccessToken(currentRefreshToken: string): Promise<RefreshResult> {
  if (!GITHUB_CLIENT_ID) {
    throw new Error("VITE_GITHUB_CLIENT_ID not configured")
  }

  const data = isElectron()
    ? await refreshDirect(currentRefreshToken)
    : await refreshViaServer(currentRefreshToken)

  // Log response shape (no token values) for diagnostics.
  logDebug("github-auth:refresh:response", {
    platform: isElectron() ? "electron-direct" : "pwa-server",
    hasAccessToken: !!data.access_token,
    hasRefreshToken: !!data.refresh_token,
    expiresIn: data.expires_in,
    error: data.error,
  })

  if (data.error || !data.access_token) {
    throw new Error(data.error_description || data.error || "Refresh failed")
  }

  return {
    accessToken: data.access_token,
    // GitHub rotates refresh tokens on each use. If it didn't, keep the old one.
    refreshToken: data.refresh_token ?? currentRefreshToken,
    expiresAt: data.expires_in ? Date.now() + data.expires_in * 1000 : undefined,
  }
}

/** Electron: call GitHub's OAuth refresh endpoint directly (no client_secret needed for Device Flow). */
async function refreshDirect(refreshToken: string): Promise<TokenResponseBody> {
  const response = await electronFetch("https://github.com/login/oauth/access_token", {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      client_id: GITHUB_CLIENT_ID,
      grant_type: "refresh_token",
      refresh_token: refreshToken,
    }),
  })
  return (await response.json()) as TokenResponseBody
}

/** PWA: proxy through our Vercel function which holds client_secret. */
async function refreshViaServer(refreshToken: string): Promise<TokenResponseBody> {
  const response = await fetch(`${API_BASE_URL}/api/github-auth-refresh`, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ refresh_token: refreshToken }),
  })
  return (await response.json()) as TokenResponseBody
}
