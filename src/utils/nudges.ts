import type { Note, Task } from "../schema"

export type Nudge = {
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

export function detectNudges(notes: Map<string, Note>, settings: NudgeSettings): Nudge[] {
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
      type: "inbox_pileup",
      message: `${unprocessedCount} items piling up in inbox`,
      priority: 2,
    })
  }

  // Sort by priority, deduplicate stale tasks (max 5)
  nudges.sort((a, b) => a.priority - b.priority)

  // Limit stale tasks to avoid noise
  let staleCount = 0
  return nudges.filter((n) => {
    if (n.type === "stale_task") {
      staleCount++
      return staleCount <= 5
    }
    return true
  })
}

function truncate(text: string, max: number): string {
  return text.length > max ? text.slice(0, max) + "…" : text
}

function stripWikilinks(text: string): string {
  return text.replace(/\[\[([^\]|]+)\|([^\]]+)\]\]/g, "$2").replace(/\[\[([^\]]+)\]\]/g, "$1")
}
