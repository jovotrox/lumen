import type { DashboardData } from "./dashboard-templates"

const SYSTEM_PROMPT = `You are generating a brief morning briefing for a personal note-taking app dashboard. Given the user's data, write a single paragraph (2-3 sentences max) summarizing what they need to focus on today. Use emoji icons inline: 📥 for inbox, ☑️ for tasks, 📁 for projects, 🔴 for urgent. Be warm but concise. The user may speak Spanish or English — match the language of project/task names if provided, otherwise default to Spanish.`

function buildUserMessage(
  data: DashboardData,
  projectNames: string[],
  urgentTaskTexts: string[],
): string {
  return JSON.stringify({
    inbox_unprocessed: data.inbox,
    tasks_today: data.tasks,
    tasks_completed_today: data.todayCompleted,
    urgent_tasks: urgentTaskTexts.slice(0, 5),
    active_projects: projectNames.slice(0, 5),
    top_project: data.topProject,
    top_project_progress: data.topProjectProgress,
  })
}

export async function generateAISummary(
  data: DashboardData,
  provider: "openai" | "claude",
  apiKey: string,
  projectNames: string[],
  urgentTaskTexts: string[],
): Promise<string> {
  const userMessage = buildUserMessage(data, projectNames, urgentTaskTexts)

  if (provider === "openai") {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: userMessage },
        ],
        temperature: 0.7,
        max_tokens: 200,
      }),
    })
    if (!response.ok) throw new Error(`OpenAI error: ${response.status}`)
    const result = (await response.json()) as { choices: { message: { content: string } }[] }
    return result.choices[0].message.content.trim()
  }

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
      max_tokens: 200,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: userMessage }],
    }),
  })
  if (!response.ok) throw new Error(`Claude error: ${response.status}`)
  const result = (await response.json()) as { content: { text: string }[] }
  return result.content[0].text.trim()
}
