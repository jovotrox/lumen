import type { Note, Task } from "../schema"

export type Nudge = {
  id: string
  type: "stale_task" | "inactive_project" | "inbox_pileup" | "overdue_followup"
  message: string
  noteId?: string
  priority: number
}

type NudgeSettings = {
  staleTaskDays: number
  inactiveProjectDays: number
  inboxThreshold: number
}

const DAY_MS = 86400000

export function detectNudges(
  notes: Map<string, Note>,
  settings: NudgeSettings,
  dismissedIds?: Set<string>,
): Nudge[] {
  const nudges: Nudge[] = []
  const now = Date.now()

  // Collect all incomplete tasks with their source notes
  for (const note of notes.values()) {
    if (note.type === "inbox" || note.type === "template") continue

    for (const task of note.tasks) {
      if (task.completed) continue

      // Overdue follow-ups: tasks with a past date
      if (task.date) {
        const dueDate = new Date(task.date + "T23:59:59").getTime()
        if (dueDate < now) {
          const daysOverdue = Math.floor((now - dueDate) / DAY_MS)
          nudges.push({
            id: `overdue:${note.id}:${simpleHash(task.text)}`,
            type: "overdue_followup",
            message: `"${truncate(stripWikilinks(task.text), 50)}" is ${daysOverdue}d overdue`,
            noteId: note.id,
            priority: 1,
          })
        }
      }

      // Stale tasks: note not updated in N days
      if (note.updatedAt) {
        const daysSinceUpdate = Math.floor((now - note.updatedAt) / DAY_MS)
        if (daysSinceUpdate >= settings.staleTaskDays) {
          nudges.push({
            id: `stale:${note.id}:${simpleHash(task.text)}`,
            type: "stale_task",
            message: `"${truncate(stripWikilinks(task.text), 50)}" pending for ${daysSinceUpdate}d`,
            noteId: note.id,
            priority: 2,
          })
        }
      }
    }
  }

  // Inactive projects
  for (const note of notes.values()) {
    if (note.type !== "project" || note.frontmatter.status !== "active") continue
    if (!note.updatedAt) continue
    const daysSinceUpdate = Math.floor((now - note.updatedAt) / DAY_MS)
    if (daysSinceUpdate >= settings.inactiveProjectDays) {
      nudges.push({
        id: `inactive:${note.id}`,
        type: "inactive_project",
        message: `${note.displayName} — no activity for ${daysSinceUpdate}d`,
        noteId: note.id,
        priority: 3,
      })
    }
  }

  // Inbox pileup
  let unprocessedCount = 0
  for (const note of notes.values()) {
    if (note.type === "inbox" && note.frontmatter.status === "unprocessed") {
      unprocessedCount++
    }
  }
  if (unprocessedCount >= settings.inboxThreshold) {
    nudges.push({
      id: `inbox_pileup:${unprocessedCount}`,
      type: "inbox_pileup",
      message: `${unprocessedCount} items piling up in inbox`,
      priority: 2,
    })
  }

  // Sort by priority, filter dismissed, limit stale tasks
  nudges.sort((a, b) => a.priority - b.priority)

  let staleCount = 0
  return nudges.filter((n) => {
    if (dismissedIds?.has(n.id)) return false
    if (n.type === "stale_task") {
      staleCount++
      return staleCount <= 5
    }
    return true
  })
}

// --- Dismiss persistence ---

const DISMISSED_KEY = "nudges_dismissed"

export function getDismissedNudges(): Set<string> {
  try {
    const raw = localStorage.getItem(DISMISSED_KEY)
    if (!raw) return new Set()
    return new Set(JSON.parse(raw) as string[])
  } catch {
    return new Set()
  }
}

export function dismissNudge(id: string): void {
  const dismissed = getDismissedNudges()
  dismissed.add(id)
  localStorage.setItem(DISMISSED_KEY, JSON.stringify([...dismissed]))
}

// --- Helpers ---

function truncate(text: string, max: number): string {
  return text.length > max ? text.slice(0, max) + "…" : text
}

function stripWikilinks(text: string): string {
  return text.replace(/\[\[([^\]|]+)\|([^\]]+)\]\]/g, "$2").replace(/\[\[([^\]]+)\]\]/g, "$1")
}

function simpleHash(str: string): string {
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash + str.charCodeAt(i)) | 0
  }
  return Math.abs(hash).toString(36)
}
