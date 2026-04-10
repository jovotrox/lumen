import type { Note } from "../schema"

export type InboxSuggestion = {
  suggested_type: "task" | "note" | "project" | "person"
  title: string
  project: string | null
  person: string | null
  priority: 1 | 2 | 3 | null
  tags: string[]
  related_notes: string[]
  confidence: number
}

const SYSTEM_PROMPT = `You are a work input classifier for a personal note-taking app. Given raw text, extract structured information.

Known people: {people}
Known projects: {projects}
Recent notes: {recentNotes}

Respond with ONLY valid JSON matching this schema:
{
  "suggested_type": "task" | "note" | "project" | "person",
  "title": "concise title",
  "project": "project-note-id or null",
  "person": "person-note-id or null",
  "priority": 1 | 2 | 3 | null,
  "tags": ["tag1", "tag2"],
  "related_notes": ["note-id-1", "note-id-2"],
  "confidence": 0.0 to 1.0
}

Rules:
- Input may be Spanish or English
- Match against known entities when possible
- Only suggest related_notes from the provided list
- suggested_type "task" = actionable item, "note" = information, "project" = new project, "person" = new person entry
- priority 1 = highest urgency`

function buildPrompt(context: { people: Note[]; projects: Note[]; recentNotes: Note[] }): string {
  const people = context.people.map((p) => `${p.id} (${p.displayName})`).join(", ") || "none"
  const projects = context.projects.map((p) => `${p.id} (${p.displayName})`).join(", ") || "none"
  const recentNotes =
    context.recentNotes
      .slice(0, 20)
      .map((n) => `${n.id} (${n.displayName})`)
      .join(", ") || "none"

  return SYSTEM_PROMPT.replace("{people}", people)
    .replace("{projects}", projects)
    .replace("{recentNotes}", recentNotes)
}

export async function classifyWithOpenAI(
  text: string,
  apiKey: string,
  context: { people: Note[]; projects: Note[]; recentNotes: Note[] },
): Promise<InboxSuggestion> {
  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: buildPrompt(context) },
        { role: "user", content: text },
      ],
      response_format: { type: "json_object" },
      temperature: 0.1,
    }),
  })

  if (!response.ok) {
    throw new Error(`OpenAI API error: ${response.status}`)
  }

  const data = (await response.json()) as { choices: { message: { content: string } }[] }
  return JSON.parse(data.choices[0].message.content) as InboxSuggestion
}

export async function classifyWithClaude(
  text: string,
  apiKey: string,
  context: { people: Note[]; projects: Note[]; recentNotes: Note[] },
): Promise<InboxSuggestion> {
  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "anthropic-dangerous-direct-browser-access": "true",
    },
    body: JSON.stringify({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 512,
      system: buildPrompt(context),
      messages: [{ role: "user", content: text }],
    }),
  })

  if (!response.ok) {
    throw new Error(`Claude API error: ${response.status}`)
  }

  const data = (await response.json()) as { content: { text: string }[] }
  const content = data.content[0].text
  return JSON.parse(content) as InboxSuggestion
}

export function classifyWithHeuristics(
  text: string,
  context: { people: Note[]; projects: Note[]; recentNotes: Note[] },
): InboxSuggestion {
  const lower = text.toLowerCase()

  let suggested_type: InboxSuggestion["suggested_type"] = "note"
  const taskPatterns =
    /\b(hacer|do|fix|send|review|talk|hablar|enviar|revisar|check|update|deploy|need to|hay que|should|must|todo)\b/
  if (taskPatterns.test(lower)) {
    suggested_type = "task"
  }

  let priority: 1 | 2 | 3 | null = null
  if (/\b(urgent|urgente|asap|critical|crítico)\b/.test(lower)) {
    priority = 1
  } else if (/\b(important|importante)\b/.test(lower)) {
    priority = 2
  }

  let person: string | null = null
  const mention = text.match(/@(\w+)/)
  if (mention) {
    const found = context.people.find(
      (p) =>
        p.id.toLowerCase() === mention[1].toLowerCase() ||
        p.displayName.toLowerCase() === mention[1].toLowerCase(),
    )
    if (found) person = found.id
  }
  if (!person) {
    for (const p of context.people) {
      if (lower.includes(p.displayName.toLowerCase()) || lower.includes(p.id.toLowerCase())) {
        person = p.id
        break
      }
    }
  }

  let project: string | null = null
  const hashtag = text.match(/#(\w+)/)
  if (hashtag) {
    const found = context.projects.find(
      (p) =>
        p.id.toLowerCase() === hashtag[1].toLowerCase() ||
        p.displayName.toLowerCase() === hashtag[1].toLowerCase(),
    )
    if (found) project = found.id
  }
  if (!project) {
    for (const p of context.projects) {
      if (lower.includes(p.displayName.toLowerCase()) || lower.includes(p.id.toLowerCase())) {
        project = p.id
        break
      }
    }
  }

  const tags = (text.match(/#(\w+)/g) ?? []).map((t) => t.slice(1))

  const words = lower.split(/\s+/).filter((w) => w.length > 3)
  const related_notes = context.recentNotes
    .filter((n) => {
      // Skip inbox items — only relate to real notes/projects/people
      if (n.type === "inbox") return false
      const noteText = (n.displayName + " " + n.id).toLowerCase()
      return words.some((w) => noteText.includes(w))
    })
    .slice(0, 3)
    .map((n) => n.id)

  const title = text.split(/[.\n]/)[0].slice(0, 80).trim() || text.slice(0, 80).trim()

  return {
    suggested_type,
    title,
    project,
    person,
    priority,
    tags,
    related_notes,
    confidence: 0.3,
  }
}

export async function classifyInboxItem(
  text: string,
  provider: "openai" | "claude" | "heuristic",
  apiKey: string,
  context: { people: Note[]; projects: Note[]; recentNotes: Note[] },
): Promise<InboxSuggestion> {
  try {
    if (provider === "openai" && apiKey) {
      return await classifyWithOpenAI(text, apiKey, context)
    }
    if (provider === "claude" && apiKey) {
      return await classifyWithClaude(text, apiKey, context)
    }
  } catch (error) {
    console.error("AI classification failed, falling back to heuristics:", error)
  }
  return classifyWithHeuristics(text, context)
}
