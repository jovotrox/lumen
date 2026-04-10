type DashboardData = {
  inbox: number
  tasks: number
  todayCompleted: number
  urgentTasks: number
  projects: number
  topProject: string | null
  topProjectProgress: string | null
}

const greetings = {
  morning: ["Buenos días", "Good morning"],
  afternoon: ["Buenas tardes", "Good afternoon"],
  evening: ["Buenas noches", "Good evening"],
}

function getGreeting(): string {
  const hour = new Date().getHours()
  const pool =
    hour < 12 ? greetings.morning : hour < 18 ? greetings.afternoon : greetings.evening
  return pool[Math.floor(Math.random() * pool.length)]
}

type TemplateFunction = (data: DashboardData, greeting: string) => string

const templates: TemplateFunction[] = [
  (d, g) =>
    `${g}. Tienes 📥 ${d.inbox} items en inbox, ☑️ ${d.tasks} tareas para hoy y 📁 ${d.projects} proyectos activos.`,
  (d, g) =>
    `${g}. 📥 ${d.inbox} por procesar, ☑️ ${d.tasks} pendientes.${d.topProject ? ` ${d.topProject} está al ${d.topProjectProgress}.` : ""}`,
  (d, g) =>
    `Tu día: 🔴 ${d.urgentTasks} urgentes, 📥 ${d.inbox} en inbox.${d.topProject ? ` 📁 ${d.topProject} avanza con ${d.topProjectProgress}.` : ""}`,
  (d, g) =>
    `${g}. You have 📥 ${d.inbox} inbox items, ☑️ ${d.tasks} tasks today and 📁 ${d.projects} active projects.`,
  (d, g) =>
    `${g}. 📥 ${d.inbox} to process, ☑️ ${d.tasks} tasks due today.${d.urgentTasks > 0 ? ` ${d.urgentTasks} are 🔴 urgent.` : ""}`,
  (d, g) =>
    `Resumen: 📁 ${d.projects} proyectos activos, ☑️ ${d.todayCompleted} tareas completadas hoy. ${d.inbox} 📥 pendientes en inbox.`,
  (d) =>
    d.tasks + d.inbox <= 2
      ? `Todo tranquilo — solo 📥 ${d.inbox} en inbox y ☑️ ${d.tasks} tareas pendientes.`
      : `Hoy tienes ☑️ ${d.tasks} tareas.${d.topProject ? ` Tu proyecto más activo es 📁 ${d.topProject} (${d.topProjectProgress}).` : ""} 📥 ${d.inbox} en inbox.`,
  (d, g) =>
    `${g}. ${d.urgentTasks > 0 ? `🔴 ${d.urgentTasks} urgente${d.urgentTasks > 1 ? "s" : ""} primero. ` : ""}📥 ${d.inbox} en inbox, ☑️ ${d.tasks} tareas, 📁 ${d.projects} proyectos.`,
]

function dateSeededIndex(length: number): number {
  const today = new Date()
  const seed = today.getFullYear() * 10000 + (today.getMonth() + 1) * 100 + today.getDate()
  return seed % length
}

export function generateTemplateSummary(data: DashboardData): string {
  const index = dateSeededIndex(templates.length)
  const greeting = getGreeting()
  return templates[index](data, greeting)
}

export type { DashboardData }
