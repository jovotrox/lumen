import git from "isomorphic-git"
import http from "isomorphic-git/http/web"
import { GitHubRepository, GitHubUser } from "../schema"
import { logDebug } from "./debug-log"
import { createElectronHttpClient, isElectron } from "./electron"
import { fs, fsWipe } from "./fs"
import { createTauriHttpClient, isTauri } from "./tauri"
import { startTimer } from "./timer"

export const REPO_DIR = "/repo"
const DEFAULT_BRANCH = "main"

/**
 * Called by isomorphic-git when an already-authenticated request still gets
 * rejected (401 on the retry). Without this, isomorphic-git just throws
 * `HTTP Error: 401` with no context, masking the real cause (bad token,
 * non-ff push, rate limit, ref corruption, etc).
 *
 * Returning nothing tells isomorphic-git to stop retrying and surface the
 * error — the HttpError will include the response body, which we log below.
 */
function onAuthFailure(url: string) {
  const msg = `auth retry failed for ${url} — token may be invalid, or GitHub rejected the request for another reason`
  console.error(`[git] ${msg}`)
  logDebug("git:auth-failure", { url })
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

export async function gitClone(repo: GitHubRepository, user: GitHubUser) {
  const httpConfig = getHttpConfig()
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
    onAuth: () => ({ username: user.login, password: user.token }),
    onAuthFailure,
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

export async function gitPull(user: GitHubUser) {
  const httpConfig = getHttpConfig()
  const options: Parameters<typeof git.pull>[0] = {
    fs,
    http: httpConfig.http,
    dir: REPO_DIR,
    corsProxy: httpConfig.corsProxy,
    singleBranch: true,
    onMessage: (message) => console.debug("onMessage", message),
    onProgress: (progress) => console.debug("onProgress", progress),
    onAuth: () => ({ username: user.login, password: user.token }),
    onAuthFailure,
  }

  const stopTimer = startTimer("git pull")
  await runGitOp("pull", () => git.pull(options))
  stopTimer()
}

export async function gitPush(user: GitHubUser) {
  const httpConfig = getHttpConfig()
  const options: Parameters<typeof git.push>[0] = {
    fs,
    http: httpConfig.http,
    dir: REPO_DIR,
    corsProxy: httpConfig.corsProxy,
    onMessage: (message) => console.debug("onMessage", message),
    onProgress: (progress) => console.debug("onProgress", progress),
    onAuth: () => ({ username: user.login, password: user.token }),
    onAuthFailure,
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
