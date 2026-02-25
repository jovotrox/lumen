import micromatch from "micromatch"
import { GitHubRepository, GitHubUser } from "../schema"
import { fs } from "./fs"
import { REPO_DIR } from "./git"
import { isTauri } from "./tauri"

/** Get the API base URL for Vercel proxy endpoints */
function getApiBaseUrl(): string {
  return import.meta.env.VITE_API_BASE_URL || ""
}

/** Check if a file is tracked with Git LFS by checking the .gitattributes file */
export async function isTrackedWithGitLfs(path: string) {
  try {
    // Get .gitattributes file
    const gitAttributes = await fs.promises.readFile(`${REPO_DIR}/.gitattributes`)

    // Parse .gitattributes file
    const parsedGitAttributes = gitAttributes
      .toString()
      .split("\n")
      .reduce(
        (acc, line) => {
          // Ignore comments
          if (line.startsWith("#")) {
            return acc
          }

          // Ignore empty lines
          if (!line.trim()) {
            return acc
          }

          // Split line into parts
          const [pattern, ...attrs] = line.split(" ")

          // Add pattern and filter to accumulator
          return [...acc, { pattern, attrs }]
        },
        [] as Array<{ pattern: string; attrs: string[] }>,
      )

    // Return true if any patterns matching the file path have filter=lfs set
    return parsedGitAttributes.some(({ pattern, attrs }) => {
      // Check if file path matches pattern and if filter=lfs is set
      return (
        micromatch.isMatch(
          path
            // Remove REPO_DIR from path
            .replace(REPO_DIR, "")
            // Remove leading slash from path
            .replace(/^\/*/, ""),
          pattern
            // Remove leading slash from pattern
            .replace(/^\//, ""),
        ) && attrs.includes("filter=lfs")
      )
    })
  } catch (error) {
    return false
  }
}

/** Resolve a Git LFS pointer to a file URL */
export async function resolveGitLfsPointer({
  file,
  githubUser,
  githubRepo,
}: {
  file: File
  githubUser: GitHubUser
  githubRepo: GitHubRepository
}) {
  const text = await file.text()

  if (isTauri()) {
    // In Tauri, call GitHub LFS API directly (no CORS restrictions)
    return resolveGitLfsPointerDirect({ pointer: text, githubUser, githubRepo })
  }

  // In browser, use Vercel API proxy
  const response = await fetch(
    `${getApiBaseUrl()}/git-lfs-file?repo=${githubRepo.owner}/${githubRepo.name}&pointer=${encodeURIComponent(text)}`,
    {
      headers: {
        Authorization: `Bearer ${githubUser.token}`,
      },
    },
  )

  if (!response.ok) {
    throw new Error("Unable to resolve Git LFS pointer")
  }

  const url = await response.text()

  if (!url) {
    throw new Error("Unable to resolve Git LFS pointer")
  }

  return url
}

/** Resolve a Git LFS pointer by calling GitHub's LFS API directly (for Tauri) */
async function resolveGitLfsPointerDirect({
  pointer,
  githubUser,
  githubRepo,
}: {
  pointer: string
  githubUser: GitHubUser
  githubRepo: GitHubRepository
}) {
  const oid = pointer.match(/oid sha256:(?<oid>[a-f0-9]{64})/)?.groups?.oid
  const size = parseInt(pointer.match(/size (?<size>\d+)/)?.groups?.size ?? "0")

  if (!oid || !Number.isFinite(size)) {
    throw new Error("Invalid LFS pointer")
  }

  const response = await fetch(
    `https://github.com/${githubRepo.owner}/${githubRepo.name}.git/info/lfs/objects/batch`,
    {
      method: "POST",
      headers: {
        Accept: "application/vnd.git-lfs+json",
        "Content-Type": "application/vnd.git-lfs+json",
        Authorization: `Bearer ${githubUser.token}`,
      },
      body: JSON.stringify({
        operation: "download",
        transfers: ["basic"],
        objects: [{ oid, size }],
      }),
    },
  )

  if (!response.ok) {
    throw new Error("Unable to resolve Git LFS pointer")
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const json: any = await response.json()
  const href = json.objects[0].actions.download.href

  if (!href) {
    throw new Error("Unable to resolve Git LFS pointer")
  }

  return href
}

/** Create a Git LFS pointer for a given file */
export async function createGitLfsPointer(content: ArrayBuffer) {
  const oid = await getOid(content)
  const size = content.byteLength

  return `version https://git-lfs.github.com/spec/v1
oid sha256:${oid}
size ${size}
`
}

/** Upload file to GitHub's Git LFS server */
export async function uploadToGitLfsServer({
  content,
  githubUser,
  githubRepo,
}: {
  content: ArrayBuffer
  githubUser: GitHubUser
  githubRepo: GitHubRepository
}) {
  if (isTauri()) {
    // In Tauri, upload directly to GitHub LFS (no CORS restrictions)
    await uploadToGitLfsServerDirect({ content, githubUser, githubRepo })
    return
  }

  // In browser, use Vercel API proxy
  const base64Content = Buffer.from(content).toString("base64")
  const oid = await getOid(content)
  const size = content.byteLength

  const response = await fetch(`${getApiBaseUrl()}/git-lfs-file`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${githubUser.token}`,
    },
    body: JSON.stringify({
      repo: `${githubRepo.owner}/${githubRepo.name}`,
      content: base64Content,
      oid,
      size,
    }),
  })

  if (!response.ok) {
    throw new Error("Unable to upload file to Git LFS server")
  }
}

/** Upload file directly to GitHub's LFS server (for Tauri) */
async function uploadToGitLfsServerDirect({
  content,
  githubUser,
  githubRepo,
}: {
  content: ArrayBuffer
  githubUser: GitHubUser
  githubRepo: GitHubRepository
}) {
  const oid = await getOid(content)
  const size = content.byteLength

  const response = await fetch(
    `https://github.com/${githubRepo.owner}/${githubRepo.name}.git/info/lfs/objects/batch`,
    {
      method: "POST",
      headers: {
        Accept: "application/vnd.git-lfs+json",
        "Content-Type": "application/vnd.git-lfs+json",
        Authorization: `Bearer ${githubUser.token}`,
      },
      body: JSON.stringify({
        operation: "upload",
        transfers: ["basic"],
        objects: [{ oid, size }],
      }),
    },
  )

  if (!response.ok) {
    throw new Error("Unable to resolve Git LFS pointer")
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const json: any = await response.json()
  const { upload, verify } = json.objects[0].actions

  const uploadResponse = await fetch(upload.href, {
    method: "PUT",
    headers: {
      ...upload.header,
      "Content-Type": "application/octet-stream",
    },
    body: content,
  })

  if (!uploadResponse.ok) {
    throw new Error("Unable to upload file")
  }

  const verifyResponse = await fetch(verify.href, {
    method: "POST",
    headers: verify.header,
    body: JSON.stringify({ oid, size }),
  })

  if (!verifyResponse.ok) {
    throw new Error("Unable to verify upload")
  }
}

/** Get the OID of a file by hashing its contents with SHA-256 */
export async function getOid(content: ArrayBuffer) {
  // Reference: https://developer.mozilla.org/en-US/docs/Web/API/SubtleCrypto/digest
  const hashBuffer = await crypto.subtle.digest("SHA-256", content)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  const hashHex = hashArray.map((b) => b.toString(16).padStart(2, "0")).join("")
  return hashHex
}
