/**
 * Exchanges a GitHub OAuth refresh_token for a fresh access_token.
 *
 * Required when the OAuth app has "Expire user authorization tokens" enabled
 * (default for OAuth apps created after late 2022) — without this, access
 * tokens die after 8h and users have to sign out + sign in manually.
 *
 * Only implemented for Electron/Tauri (Device Flow) for now. The web PWA path
 * needs a Vercel function because GitHub requires `client_secret` on the
 * web OAuth flow's refresh endpoint, and we don't ship the secret to the
 * browser.
 */

import { logDebug } from "./debug-log"
import { electronFetch, isElectron } from "./electron"

const GITHUB_CLIENT_ID = import.meta.env.VITE_GITHUB_CLIENT_ID

export type RefreshResult = {
  accessToken: string
  refreshToken: string
  /** Epoch ms when the new accessToken will expire, if GitHub told us. */
  expiresAt?: number
}

export function canRefreshTokens(): boolean {
  // Only Electron right now — extend when we add a server-side refresh endpoint.
  return isElectron()
}

export async function refreshAccessToken(currentRefreshToken: string): Promise<RefreshResult> {
  if (!canRefreshTokens()) {
    throw new Error("Token refresh not supported in this environment")
  }
  if (!GITHUB_CLIENT_ID) {
    throw new Error("VITE_GITHUB_CLIENT_ID not configured")
  }

  const response = await electronFetch("https://github.com/login/oauth/access_token", {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      client_id: GITHUB_CLIENT_ID,
      grant_type: "refresh_token",
      refresh_token: currentRefreshToken,
    }),
  })

  const data = (await response.json()) as {
    access_token?: string
    refresh_token?: string
    expires_in?: number
    error?: string
    error_description?: string
  }

  // Log response shape (no token values) for diagnostics.
  logDebug("github-auth:refresh:response", {
    httpStatus: response.status,
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
