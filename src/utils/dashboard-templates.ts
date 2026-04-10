export type DashboardData = {
  inbox: number
  tasks: number
  todayCompleted: number
  urgentTasks: number
  projects: number
  topProject: string | null
  topProjectProgress: string | null
  nickname: string
}

function getGreeting(): string {
  const hour = new Date().getHours()
  if (hour < 12) return "Good morning"
  if (hour < 18) return "Good afternoon"
  return "Good evening"
}

type TemplateFunction = (d: DashboardData) => string

const templates: TemplateFunction[] = [
  (d) => {
    const hi = `${getGreeting()}${d.nickname ? `, ${d.nickname}` : ""}. `
    const parts: string[] = []
    if (d.tasks > 0) parts.push(`☑️ ${d.tasks} task${d.tasks > 1 ? "s" : ""} today`)
    if (d.inbox > 0) parts.push(`📥 ${d.inbox} in inbox`)
    if (d.projects > 0) parts.push(`📁 ${d.projects} active project${d.projects > 1 ? "s" : ""}`)
    if (d.urgentTasks > 0) parts.push(`🔴 ${d.urgentTasks} urgent`)
    if (parts.length === 0) return `${hi}You're all clear today. Nothing pending.`
    return `${hi}You have ${joinParts(parts)}.${d.topProject ? ` ${d.topProject} is at ${d.topProjectProgress}.` : ""}`
  },
  (d) => {
    const hi = `${getGreeting()}${d.nickname ? `, ${d.nickname}` : ""}. `
    if (d.tasks === 0 && d.inbox === 0 && d.urgentTasks === 0) {
      return `${hi}All quiet — enjoy your day.`
    }
    let msg = hi
    if (d.urgentTasks > 0) msg += `🔴 ${d.urgentTasks} urgent first. `
    if (d.tasks > 0) msg += `☑️ ${d.tasks} task${d.tasks > 1 ? "s" : ""} for today. `
    if (d.inbox > 0) msg += `📥 ${d.inbox} to process. `
    if (d.topProject) msg += `📁 ${d.topProject} at ${d.topProjectProgress}.`
    return msg.trim()
  },
  (d) => {
    const hi = `Hey${d.nickname ? ` ${d.nickname}` : ""}! `
    const parts: string[] = []
    if (d.inbox > 0) parts.push(`📥 ${d.inbox} inbox item${d.inbox > 1 ? "s" : ""}`)
    if (d.tasks > 0) parts.push(`☑️ ${d.tasks} pending task${d.tasks > 1 ? "s" : ""}`)
    if (d.urgentTasks > 0) parts.push(`🔴 ${d.urgentTasks} marked urgent`)
    if (parts.length === 0) return `${hi}Nothing on your plate. Time to create something new.`
    return `${hi}Today you have ${joinParts(parts)}.${d.todayCompleted > 0 ? ` Already done: ☑️ ${d.todayCompleted}.` : ""}`
  },
  (d) => {
    const hi = `Hola${d.nickname ? ` ${d.nickname}` : ""}. `
    const parts: string[] = []
    if (d.tasks > 0) parts.push(`☑️ ${d.tasks} tarea${d.tasks > 1 ? "s" : ""} hoy`)
    if (d.inbox > 0) parts.push(`📥 ${d.inbox} en inbox`)
    if (d.urgentTasks > 0) parts.push(`🔴 ${d.urgentTasks} urgente${d.urgentTasks > 1 ? "s" : ""}`)
    if (d.projects > 0)
      parts.push(
        `📁 ${d.projects} proyecto${d.projects > 1 ? "s" : ""} activo${d.projects > 1 ? "s" : ""}`,
      )
    if (parts.length === 0) return `${hi}Todo en orden. Sin pendientes por ahora.`
    return `${hi}Tienes ${joinParts(parts)}.${d.topProject ? ` ${d.topProject} va en ${d.topProjectProgress}.` : ""}`
  },
  (d) => {
    const hi = `${getGreeting()}${d.nickname ? `, ${d.nickname}` : ""}. `
    if (d.tasks + d.inbox + d.urgentTasks === 0) {
      return `${hi}Clear skies ahead — no tasks, no inbox. Maybe start a new note?`
    }
    const summary = [
      d.urgentTasks > 0 && `🔴 ${d.urgentTasks} urgent`,
      d.tasks > 0 && `☑️ ${d.tasks} to do`,
      d.inbox > 0 && `📥 ${d.inbox} to sort`,
    ]
      .filter(Boolean)
      .join(", ")
    return `${hi}Here's your day: ${summary}.${d.topProject ? ` Your most active project is 📁 ${d.topProject} (${d.topProjectProgress}).` : ""}`
  },
  (d) => {
    const hi = `Buenos días${d.nickname ? `, ${d.nickname}` : ""}. `
    if (d.tasks + d.inbox + d.urgentTasks === 0) {
      return `${hi}No hay pendientes. Buen momento para organizar ideas.`
    }
    let msg = `${hi}Tu resumen: `
    if (d.tasks > 0) msg += `☑️ ${d.tasks} tarea${d.tasks > 1 ? "s" : ""}. `
    if (d.inbox > 0) msg += `📥 ${d.inbox} por procesar. `
    if (d.urgentTasks > 0) msg += `🔴 ${d.urgentTasks} urgente${d.urgentTasks > 1 ? "s" : ""}. `
    if (d.topProject) msg += `📁 ${d.topProject} al ${d.topProjectProgress}.`
    return msg.trim()
  },
]

function joinParts(parts: string[]): string {
  if (parts.length <= 1) return parts[0] ?? ""
  return parts.slice(0, -1).join(", ") + " and " + parts[parts.length - 1]
}

function dateSeededIndex(length: number): number {
  const today = new Date()
  const seed = today.getFullYear() * 10000 + (today.getMonth() + 1) * 100 + today.getDate()
  return seed % length
}

export function generateTemplateSummary(data: DashboardData): string {
  const index = dateSeededIndex(templates.length)
  return templates[index](data)
}
