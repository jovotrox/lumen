import git from "isomorphic-git"
import http from "isomorphic-git/http/web"
import { GitHubRepository, GitHubUser } from "../schema"
import { logDebug } from "./debug-log"
import { createElectronHttpClient, electronFetch, isElectron } from "./electron"
import { fs, fsWipe } from "./fs"
import { canRefreshTokens, refreshAccessToken } from "./github-auth-refresh"
import { createTauriHttpClient, isTauri } from "./tauri"
import { startTimer } from "./timer"

export const REPO_DIR = "/repo"
const DEFAULT_BRANCH = "main"

/**
 * Optional callback invoked when the access_token was refreshed mid-sync.
 * Callers (global-state.ts) pass this to propagate the new token back into
 * the Jotai store / localStorage so future syncs use it.
 */
export type OnTokenRefreshed = (user: GitHubUser) => void

/**
 * Builds the isomorphic-git `onAuthFailure` callback for a given git
 * operation. Keeps `currentUser` as a mutable closure variable so that after
 * a successful refresh, subsequent `onAuth` calls within the same git op
 * return the new token.
 *
 * Logic on 401:
 *   1. Log what was sent (safely — token prefix only, never the full value).
 *   2. Fire a throttled probe to `/user` + `/repos/owner/name` for diagnostics.
 *   3. Attempt to refresh the access_token if we have a refresh_token.
 *      - If refresh succeeds, return new {username, password} — isomorphic-git
 *        retries with the new token and (usually) succeeds.
 *      - If refresh fails or isn't available, return undefined — isomorphic-git
 *        bails out with HttpError which `runGitOp` then surfaces.
 */
function makeAuthFailureHandler(
  getUser: () => GitHubUser,
  setUser: (user: GitHubUser) => void,
  onTokenRefreshed?: OnTokenRefreshed,
) {
  return async function onAuthFailure(
    url: string,
    auth: { username?: string; password?: string; headers?: Record<string, string> },
  ): Promise<{ username: string; password: string } | undefined> {
    const username = auth.username ?? "(none)"
    const token = auth.password ?? ""
    const tokenInfo = token
      ? { prefix: token.slice(0, 4), length: token.length }
      : { prefix: "(none)", length: 0 }

    console.error(
      `[git] auth retry failed for ${url} — username="${username}", token prefix="${tokenInfo.prefix}…" length=${tokenInfo.length}`,
    )
    logDebug("git:auth-failure", {
      url,
      username,
      tokenPrefix: tokenInfo.prefix,
      tokenLength: tokenInfo.length,
    })

    void maybeProbeAuth(url, token)

    // Attempt refresh
    const user = getUser()
    if (!canRefreshTokens()) {
      logDebug("git:refresh:skipped", { reason: "env not supported" })
      return
    }
    if (!user.refreshToken) {
      logDebug("git:refresh:skipped", { reason: "no refresh_token on user" })
      return
    }
    try {
      const refreshed = await refreshAccessToken(user.refreshToken)
      const newUser: GitHubUser = {
        ...user,
        token: refreshed.accessToken,
        refreshToken: refreshed.refreshToken,
        expiresAt: refreshed.expiresAt,
      }
      setUser(newUser)
      onTokenRefreshed?.(newUser)
      logDebug("git:refresh:success", {
        newTokenPrefix: refreshed.accessToken.slice(0, 4),
        newTokenLength: refreshed.accessToken.length,
        expiresAt: refreshed.expiresAt,
      })
      return { username: newUser.login, password: newUser.token }
    } catch (err) {
      logDebug("git:refresh:failed", { error: err instanceof Error ? err.message : String(err) })
      return
    }
  }
}

/**
 * Probes GitHub's REST API to determine whether the token is valid for
 * general use (/user) and for the specific repo the git op is targeting
 * (/repos/{owner}/{name}). Results go into the debug log so we can tell
 * apart "token is dead" vs "token is fine but has no access to this repo".
 */
let lastProbeAt = 0
async function maybeProbeAuth(repoUrl: string, token: string) {
  if (!token) return
  const now = Date.now()
  if (now - lastProbeAt < 60_000) return
  lastProbeAt = now

  try {
    const userResult = await apiProbe("https://api.github.com/user", token)
    const probe: Record<string, unknown> = {
      repoUrl,
      apiUser: {
        status: userResult.status,
        login: userResult.body?.login,
        scopes: userResult.headers["x-oauth-scopes"],
      },
    }

    const match = repoUrl.match(/^https:\/\/github\.com\/([^/]+)\/([^/.]+?)(?:\.git)?\/?$/)
    const owner = match?.[1]
    const name = match?.[2]
    if (owner && name) {
      const repoResult = await apiProbe(`https://api.github.com/repos/${owner}/${name}`, token)
      probe.apiRepo = {
        owner,
        name,
        status: repoResult.status,
        // Surface the error message if the call failed — "Not Found" vs
        // "Bad credentials" distinguishes missing access from dead token.
        message: repoResult.status >= 400 ? repoResult.body?.message : undefined,
        private: repoResult.status === 200 ? repoResult.body?.private : undefined,
      }
    }

    logDebug("git:auth-probe", probe)
  } catch (err) {
    logDebug("git:auth-probe-failed", { error: String(err), repoUrl })
  }
}

async function apiProbe(
  url: string,
  token: string,
): Promise<{
  status: number
  body: Record<string, unknown> & { login?: string; private?: boolean; message?: string }
  headers: Record<string, string>
}> {
  const headers = {
    Authorization: `Bearer ${token}`,
    Accept: "application/vnd.github+json",
  }
  // In Electron, use IPC fetch to bypass CORS; in browser, api.github.com has CORS headers
  const res = isElectron() ? await electronFetch(url, { headers }) : await fetch(url, { headers })
  let body: Record<string, unknown> & { login?: string; private?: boolean; message?: string } = {}
  try {
    body = (await res.json()) as typeof body
  } catch {
    // Ignore
  }
  const headerRecord: Record<string, string> = {}
  res.headers.forEach((v, k) => {
    headerRecord[k] = v
  })
  return { status: res.status, body, headers: headerRecord }
}

/**
 * Wraps a git network operation so any `HttpError` surfaces with the actual
 * status code + response body from GitHub, instead of the opaque
 * "HTTP Error: 401" that isomorphic-git throws by default.
 */
async function runGitOp<T>(label: string, fn: () => Promise<T>): Promise<T> {
  try {
    return await fn()
  } catch (err) {
    const e = err as {
      code?: string
      data?: { statusCode?: number; statusMessage?: string; response?: unknown }
      message?: string
    }
    if (e?.code === "HttpError" && e.data) {
      const { statusCode, statusMessage, response } = e.data
      const body =
        typeof response === "string"
          ? response.length > 500
            ? `${response.slice(0, 500)}…`
            : response
          : response
      console.error(
        `[git ${label}] HTTP ${statusCode} ${statusMessage ?? ""} — response body:`,
        body,
      )
      logDebug(`git:${label}:http-error`, {
        statusCode,
        statusMessage,
        response: body,
      })
    } else {
      console.error(`[git ${label}] error:`, err)
      logDebug(`git:${label}:error`, {
        message: e?.message ?? String(err),
        code: e?.code,
      })
    }
    throw err
  }
}

// Get the API base URL for web (Vercel deployment)
// In Tauri/Electron, we don't need this as we bypass CORS
// In local dev with Vercel, relative paths work
// In GitHub Pages, we need the full Vercel URL
function getApiBaseUrl(): string {
  return import.meta.env.VITE_API_BASE_URL || ""
}

// Get the appropriate HTTP client and cors proxy based on environment
function getHttpConfig() {
  if (isTauri()) {
    // In Tauri, use direct HTTP without CORS proxy
    return {
      http: createTauriHttpClient(),
      corsProxy: undefined,
    }
  }
  if (isElectron()) {
    // In Electron, use IPC-based HTTP without CORS proxy
    return {
      http: createElectronHttpClient(),
      corsProxy: undefined,
    }
  }
  // In browser, use cors proxy
  return {
    http,
    corsProxy: `${getApiBaseUrl()}/cors-proxy`,
  }
}

export async function gitClone(
  repo: GitHubRepository,
  user: GitHubUser,
  onTokenRefreshed?: OnTokenRefreshed,
) {
  const httpConfig = getHttpConfig()
  let currentUser = user
  const options: Parameters<typeof git.clone>[0] = {
    fs,
    http: httpConfig.http,
    dir: REPO_DIR,
    corsProxy: httpConfig.corsProxy,
    url: `https://github.com/${repo.owner}/${repo.name}`,
    ref: DEFAULT_BRANCH,
    singleBranch: true,
    depth: 1,
    onMessage: (message) => console.debug("onMessage", message),
    onProgress: (progress) => console.debug("onProgress", progress),
    onAuth: () => ({ username: currentUser.login, password: currentUser.token }),
    onAuthFailure: makeAuthFailureHandler(
      () => currentUser,
      (u) => {
        currentUser = u
      },
      onTokenRefreshed,
    ),
  }

  // Wipe file system and wait for deletion to complete before cloning
  // TODO: Only remove the repo directory instead of wiping the entire file system
  // Blocked by https://github.com/isomorphic-git/lightning-fs/issues/71
  await fsWipe()

  // Clone repo
  let stopTimer = startTimer(`git clone ${options.url} ${options.dir}`)
  await runGitOp("clone", () => git.clone(options))
  stopTimer()

  // Set user in git config
  stopTimer = startTimer(`git config user.name "${user.name}"`)
  await git.setConfig({ fs, dir: REPO_DIR, path: "user.name", value: user.name })
  stopTimer()

  // Set email in git config
  stopTimer = startTimer(`git config user.email "${user.email}"`)
  await git.setConfig({ fs, dir: REPO_DIR, path: "user.email", value: user.email })
  stopTimer()
}

export async function gitPull(user: GitHubUser, onTokenRefreshed?: OnTokenRefreshed) {
  const httpConfig = getHttpConfig()
  let currentUser = user
  const options: Parameters<typeof git.pull>[0] = {
    fs,
    http: httpConfig.http,
    dir: REPO_DIR,
    corsProxy: httpConfig.corsProxy,
    singleBranch: true,
    onMessage: (message) => console.debug("onMessage", message),
    onProgress: (progress) => console.debug("onProgress", progress),
    onAuth: () => ({ username: currentUser.login, password: currentUser.token }),
    onAuthFailure: makeAuthFailureHandler(
      () => currentUser,
      (u) => {
        currentUser = u
      },
      onTokenRefreshed,
    ),
  }

  const stopTimer = startTimer("git pull")
  await runGitOp("pull", () => git.pull(options))
  stopTimer()
}

export async function gitPush(user: GitHubUser, onTokenRefreshed?: OnTokenRefreshed) {
  const httpConfig = getHttpConfig()
  let currentUser = user
  const options: Parameters<typeof git.push>[0] = {
    fs,
    http: httpConfig.http,
    dir: REPO_DIR,
    corsProxy: httpConfig.corsProxy,
    onMessage: (message) => console.debug("onMessage", message),
    onProgress: (progress) => console.debug("onProgress", progress),
    onAuth: () => ({ username: currentUser.login, password: currentUser.token }),
    onAuthFailure: makeAuthFailureHandler(
      () => currentUser,
      (u) => {
        currentUser = u
      },
      onTokenRefreshed,
    ),
  }

  const stopTimer = startTimer("git push")
  await runGitOp("push", () => git.push(options))
  stopTimer()
}

export async function gitAdd(filePaths: string[]) {
  const options: Parameters<typeof git.add>[0] = {
    fs,
    dir: REPO_DIR,
    filepath: filePaths,
  }

  const stopTimer = startTimer(`git add ${filePaths.join(" ")}`)
  await git.add(options)
  stopTimer()
}

export async function gitRemove(filePath: string) {
  const options: Parameters<typeof git.remove>[0] = {
    fs,
    dir: REPO_DIR,
    filepath: filePath,
  }

  const stopTimer = startTimer(`git remove ${filePath}`)
  await git.remove(options)
  stopTimer()
}

export async function gitCommit(message: string) {
  const options: Parameters<typeof git.commit>[0] = {
    fs,
    dir: REPO_DIR,
    message,
  }

  const stopTimer = startTimer(`git commit -m "${message}"`)
  await git.commit(options)
  stopTimer()
}

/** Check if the repo is synced with the remote origin */
export async function isRepoSynced() {
  const latestLocalCommit = await git.resolveRef({
    fs,
    dir: REPO_DIR,
    ref: `refs/heads/${DEFAULT_BRANCH}`,
  })

  const latestRemoteCommit = await git.resolveRef({
    fs,
    dir: REPO_DIR,
    ref: `refs/remotes/origin/${DEFAULT_BRANCH}`,
  })

  const isSynced = latestLocalCommit === latestRemoteCommit

  return isSynced
}

export async function getRemoteOriginUrl() {
  // Check git config for remote origin url
  const remoteOriginUrl = await git.getConfig({
    fs,
    dir: REPO_DIR,
    path: "remote.origin.url",
  })

  return remoteOriginUrl
}
