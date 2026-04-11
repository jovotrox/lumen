# CONTEXT.md

Este archivo contiene el contexto actual del proyecto para mantener continuidad entre sesiones de Claude Code.

**Última actualización:** 2026-04-10

---

## Estado Actual del Proyecto

### Branch Activo

- **Branch:** `feature/flowos-integration` (desde `personal`)
- **Estado:** FlowOS integration completa (4 fases + polish) — pendiente merge a personal
- **Último commit:** Polish + Settings hierarchy fix

### Arquitectura de Actualizaciones Automáticas

La app Tauri carga el frontend desde GitHub Pages en lugar de archivos embebidos:

```
┌─────────────────────────────────────────────────────────────┐
│  Lumen.app (Tauri)                                          │
│                                                              │
│  frontendDist: "https://jovotrox.github.io/lumen/"          │
│                           │                                  │
│                           ▼                                  │
│  ┌─────────────────────────────────────────────────────────┐│
│  │ GitHub Pages (frontend actualizado automáticamente)     ││
│  │ - Desplegado por deploy-pages.yml                       ││
│  │ - Incluye version.json para update detection            ││
│  └─────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────┘
```

**Beneficio:** Los cambios en el frontend se aplican automáticamente sin necesidad de rebuild de la app.

**Cuándo SÍ se necesita rebuild:**

- Cambios en código Rust (`src-tauri/`)
- Cambios en `Cargo.toml` o `tauri.conf.json`
- Nuevas features nativas (shortcuts, tray, etc.)

### Configuraciones Clave

#### `src-tauri/tauri.conf.json`

```json
{
  "build": {
    "frontendDist": "https://jovotrox.github.io/lumen/"
  },
  "app": {
    "windows": [
      {
        "devtools": true
      }
    ]
  }
}
```

#### `src-tauri/Cargo.toml`

```toml
tauri = { version = "2", features = ["tray-icon", "devtools"] }
```

#### `src/index.tsx` - Basepath para GitHub Pages

```typescript
const basepath =
  import.meta.env.BASE_URL === "/" ? undefined : import.meta.env.BASE_URL.replace(/\/$/, "")
```

---

## Flujo de Sincronización

```
upstream/main ──────┐
(lumen-notes/lumen) │
                    │  GitHub Action (diario 6:00 UTC)
                    │  .github/workflows/sync-upstream.yml
                    ▼
            personal branch ──────┐
            (jovotrox/lumen)      │
                                  │  GitHub Action (on push)
                                  │  .github/workflows/deploy-pages.yml
                                  ▼
                          GitHub Pages
                          jovotrox.github.io/lumen/
                                  │
                                  │  Tauri carga desde URL
                                  ▼
                            Lumen.app
```

---

## Archivos Modificados (vs upstream)

| Archivo                                     | Tipo de Cambio | Propósito                                                                  |
| ------------------------------------------- | -------------- | -------------------------------------------------------------------------- |
| `src-tauri/*`                               | Nuevo          | Wrapper Tauri completo                                                     |
| `src/index.tsx`                             | Modificado     | Basepath para GitHub Pages                                                 |
| `src/hooks/use-update-notifier.ts`          | Modificado     | Cache clearing + PWA update support                                        |
| `src/routes/quick-note.tsx`                 | Nuevo          | Ventana de nota rápida con live preview                                    |
| `src/codemirror-extensions/live-preview.ts` | Nuevo          | Live preview estilo Obsidian para Quick Note                               |
| `src/components/note-editor.tsx`            | Modificado     | Añadido prop livePreview                                                   |
| `src/routes/_appRoot.tasks.tsx`             | Nuevo          | Vista Tasks con tareas y notas                                             |
| `src/components/tasks-view.tsx`             | Modificado     | Tasks page (usa TaskListItemWrapper)                                       |
| `src/components/nav-items.tsx`              | Modificado     | Añadido link a Tasks en sidebar                                            |
| `src/components/markdown.tsx`               | Modificado     | Priority menu + strikethrough + hide completed + ListItemExtensionsContext |
| `src/components/task-list-item-wrapper.tsx` | Nuevo          | Wrapper que renderiza tasks via MarkdownContent/ListItem                   |
| `src/components/github-auth-tauri.tsx`      | Nuevo          | OAuth Device Flow                                                          |
| `src/hooks/use-external-links.ts`           | Nuevo          | Links en navegador sistema                                                 |
| `src/utils/tauri.ts`                        | Nuevo          | Utilidades Tauri                                                           |
| `src/utils/git-lfs.ts`                      | Modificado     | LFS resolution con API base URL + llamadas directas Tauri                  |
| `src/utils/gist.ts`                         | Modificado     | getApiBaseUrl (Vercel) + inline embeds                                     |
| `src/utils/inline-note-embeds.ts`           | Upstream       | Inline embeds al publicar gists                                            |
| `src/utils/reorder-list-item.ts`            | Modificado     | Función moveListItemToEnd                                                  |
| `.github/workflows/sync-upstream.yml`       | Nuevo          | Auto-sync con upstream                                                     |
| `.github/workflows/deploy-pages.yml`        | Nuevo          | Deploy a GitHub Pages                                                      |
| `.prettierignore`                           | Modificado     | Ignore .claude/settings.local.json                                         |
| `index.html`                                | Modificado     | SPA redirect handler + favicon link                                        |
| `404.html`                                  | Nuevo          | GitHub Pages SPA fallback                                                  |
| `src/utils/themes.ts`                       | Nuevo          | Sistema de temas (6 built-in + custom)                                     |
| `src/utils/theme-sync.ts`                   | Nuevo          | Sync themes a `.lumen/themes.json`                                         |
| `src/utils/ai-classify.ts`                  | Nuevo          | AI classification (OpenAI, Claude, heuristic fallback)                     |
| `src/hooks/use-theme-sync.ts`               | Nuevo          | Hook para sincronizar themes en repo                                       |
| `src/components/projects-view.tsx`          | Nuevo          | Vista de proyectos con status badges y task counts                         |
| `src/components/people-view.tsx`            | Nuevo          | Vista de personas con roles y task counts                                  |
| `src/components/inbox-view.tsx`             | Nuevo          | Vista inbox con AI classification y acciones                               |
| `src/components/ai-key-input.tsx`           | Nuevo          | Input reusable para API keys                                               |
| `src/routes/_appRoot.projects.tsx`          | Nuevo          | Ruta /projects                                                             |
| `src/routes/_appRoot.people.tsx`            | Nuevo          | Ruta /people                                                               |
| `src/routes/_appRoot.inbox.tsx`             | Nuevo          | Ruta /inbox                                                                |
| `src/routes/_appRoot.settings.tsx`          | Modificado     | Theme selector + AI provider + Claude key                                  |
| `src/global-state.ts`                       | Modificado     | Atoms: theme, entities, inbox, AI config                                   |
| `src/routes/_appRoot.tsx`                   | Modificado     | Apply theme + titlebar + inbox mode handler                                |
| `src/schema.ts`                             | Modificado     | NoteType extended con project/person/inbox                                 |
| `src/utils/parse-note.ts`                   | Modificado     | Detecta type desde frontmatter                                             |
| `src/components/note-editor.tsx`            | Modificado     | @ mention trigger + entity type labels en [[                               |
| `src/routes/_appRoot.notes_.$.tsx`          | Modificado     | isReadMode prop for hide completed tasks                                   |
| `src/routes/_appRoot.notes.index.tsx`       | Modificado     | Notes list route (was redirect to /)                                       |
| `src/components/dashboard-view.tsx`         | Nuevo          | Home dashboard: greeting, weather, nudges, sections, quick actions         |
| `src/utils/dashboard-templates.ts`          | Nuevo          | Greeting template pool with date-seeded rotation                           |
| `src/utils/dashboard-ai.ts`                 | Nuevo          | AI summary generation (OpenAI/Claude)                                      |
| `src/utils/nudges.ts`                       | Nuevo          | Nudge detection: stale tasks, inactive projects, inbox pileup, overdue     |
| `src/components/property-value.tsx`         | Modificado     | Pass frontmatterKey to NoteEditor for property autocomplete                |
| `src/components/app-layout.tsx`             | Modificado     | Titlebar padding (collapsed sidebar)                                       |
| `src/components/sidebar.tsx`                | Modificado     | Titlebar padding + drag + border extend                                    |
| `src/styles/variables.css`                  | Modificado     | color-scheme: dark + titlebar height                                       |
| `vite.config.ts`                            | Modificado     | PWA manifest start_url y scope                                             |
| `vercel.json`                               | Modificado     | installCommand para devDependencies                                        |

---

## Credenciales y Configuración

- **GitHub OAuth App ID:** `Ov23liTryXqk6yLSWeYW`
- **OAuth Callback URL:** `https://lumen-wheat-chi.vercel.app/github-auth`
- **Vercel API URL:** `https://lumen-wheat-chi.vercel.app`
- **`.env.local`:** Contiene `VITE_GITHUB_CLIENT_ID` (no modificar)

### GitHub Actions Secrets (repo settings)

| Secret                  | Valor                                |
| ----------------------- | ------------------------------------ |
| `VITE_GITHUB_CLIENT_ID` | `Ov23liTryXqk6yLSWeYW`               |
| `VITE_API_BASE_URL`     | `https://lumen-wheat-chi.vercel.app` |

---

## Comandos Frecuentes

```bash
# Desarrollo
npm run tauri:dev

# Build e instalación
npm run tauri:build
cp -r src-tauri/target/release/bundle/macos/Lumen.app /Applications/

# Limpiar caché de WebKit (si hay problemas de caché)
rm -rf ~/Library/WebKit/com.lumen.notes ~/Library/Caches/com.lumen.notes

# Sync manual con upstream
git fetch upstream
git merge upstream/main --no-edit
git push origin personal
```

---

## Problemas Conocidos y Soluciones

### Caché de WebKit

Si la app no muestra cambios recientes:

1. Usar el botón "Refresh" cuando aparece notificación de update
2. O limpiar manualmente: `rm -rf ~/Library/WebKit/com.lumen.notes ~/Library/Caches/com.lumen.notes`

### DevTools en Release Build

Para abrir DevTools: `Cmd + Option + I` o click derecho → Inspect Element
(Requiere `devtools` feature en Cargo.toml)

### Conflictos en Auto-sync

Si el GitHub Action falla por conflictos:

```bash
git checkout personal
git fetch upstream
git merge upstream/main
# Resolver conflictos manualmente
git commit -m "chore: resolve merge conflicts"
git push origin personal
```

---

## Historial de Cambios Importantes

### 2026-04-10

- **FlowOS Integration — Phase 1: Entities + Mention Picker**
  - `NoteType` extended with `"project" | "person" | "inbox"`
  - Notes with `type: project/person` in frontmatter detected by `parseNote()`
  - `projectsAtom`, `peopleAtom` derived from `notesAtom`
  - `/projects` and `/people` routes with list views, search, status badges
  - `@` mention trigger in CodeMirror editor opens grouped entity picker (People/Projects/Notes)
  - `[[` completion enhanced with entity type labels
  - Lucide React installed for new icons
  - Archivos: `schema.ts`, `parse-note.ts`, `global-state.ts`, `nav-items.tsx`, `projects-view.tsx`, `people-view.tsx`, `note-editor.tsx`, + route files
- **FlowOS Integration — Phase 2: Smart Inbox + AI Classification**
  - Quick Note has Note/Inbox toggle (SegmentedControl)
  - Inbox mode saves with `type: inbox`, `status: unprocessed`, `source: quick-note` frontmatter
  - `/inbox` route shows unprocessed items with AI classification
  - AI classification: OpenAI (gpt-4o-mini) or Claude (haiku) with heuristic fallback
  - Settings: Claude API key input + AI provider selector (OpenAI/Claude)
  - Archivos: `quick-note.tsx`, `_appRoot.tsx`, `global-state.ts`, `ai-classify.ts`, `inbox-view.tsx`, `ai-key-input.tsx`, `_appRoot.settings.tsx`, + route files
- **FlowOS — Phase 2 Feedback (7 items + extras)**
  - Cmd+Enter save+close in Quick Note
  - Inbox: friendly titles, status badges, wikilink rendering, sidebar badge count
  - Classification badges with icons+colors, heuristic pre-classification on load
  - Task conversion appends `- [ ] title [[id]]` to today's daily note
  - "+ New" IconButton on /projects and /people views
  - Frontmatter autocomplete in editor (inside ---) AND Properties panel (read mode)
  - Predefined values with color indicators for status/priority/type
  - Convert button as dropdown with all type options
  - Related notes exclude self-references + tooltip preview on hover
- **FlowOS — Phase 3: Home Dashboard**
  - `/` is always Home (dashboard), `/notes` is the notes list
  - Date header + weather via wttr.in (free, no API key, C/F configurable)
  - Personalized greeting: "Good evening, Javo." with nickname from Settings
  - AI summary (OpenAI/Claude) with template fallback (8 variants, date-seeded)
  - Summary shows linked counts: tasks, inbox, projects, urgent — each clickable
  - Quick action buttons: Daily note, New task, New note
  - Sections: Inbox, Today's tasks (interactive checkboxes), Urgent (P1/P2), Projects (progress bar), Recent notes
  - Empty state when nothing pending with invite to create daily note
  - Sidebar reordered: Home, Inbox, Calendar, Notes, Projects, Tasks, Links, People, Tags
  - Settings: Nickname + Temperature unit (°C/°F)
- **FlowOS — Phase 4: Nudges**
  - 4 nudge types: stale tasks (7d), inactive projects (14d), inbox pileup (5+), overdue follow-ups
  - "Needs attention" section in dashboard with typed icons and action links
  - Dismiss button (×) per nudge — persisted in localStorage, reappears if note changes
  - Greeting includes nudge count in yellow: "3 items need your attention."
  - Web Notification API: fires once per day on app focus with top 3 nudges
  - Configurable thresholds in Settings > Nudges (days/items + notification toggle)
  - Atoms: `nudgesAtom`, `nudgeDismissVersionAtom`, 4 threshold atoms
- **Visual Polish**
  - Project cards: richer display with content preview, progress bar, owner/deadline/pending count, overdue detection (red)
  - People cards: card-1 style with proper padding and spacing
  - Autocomplete dropdown: matches DropdownMenu style (font-content, h-8, bg-bg-hover)
  - Lucide SVG icons in property autocomplete via CSS data URIs (status dots, priority shapes, type icons)
  - Date autocomplete for deadline/due/date keys (Today, Tomorrow, Next Monday, chrono-node natural language)
  - Wikilinks show note displayName instead of numeric ID
  - Task text in dashboard cleaned of bare note IDs and trailing dates
  - Task conversion from inbox no longer appends wikilink (was showing duplicate title)
  - Daily notes created without # heading (matches normal creation flow)
  - Settings: Home and Nudges sections wrapped in SettingsSection cards (consistent hierarchy)
  - Sidebar reordered: Home, Inbox, Calendar, Notes, Projects, Tasks, Links, People, Tags
  - Dates displayed as DD-MM-YYYY in project cards
  - Filtered out "undefined"/"null"/"converted" from frontmatter autocomplete suggestions
- **Theme updates**: Updated GitHub (Primer v2), Notion, VS Code (2025), Obsidian colors. Added live preview for custom theme creation.
- **Sync workflow fix**: Moved sync-upstream.yml to run from `personal` branch. Reset `main` to mirror upstream.

### 2026-02-25

- **Unificar rendering de tasks (Tasks page usa ListItem de upstream)**: La página Tasks ahora renderiza tasks a través de `MarkdownContent`/`ListItem` en vez de un componente separado `TaskItem`
  - Cualquier cambio futuro de upstream a `ListItem` (nuevas acciones, mejoras UI) aparece automáticamente en la Tasks page
  - `ListItemExtensionsContext`: Context para inyectar menu items extra al dropdown de `ListItem` (~3 líneas de cambio en `ListItem`)
  - `TaskListItemWrapper`: Wrapper que renderiza tasks via `MarkdownContent`, con inline editing y schedule via context injection
  - `tasks-view.tsx` simplificado: usa `TaskListItemWrapper` en vez de `TaskItem` con muchos callbacks
  - Archivos: `markdown.tsx` (+9 líneas), `task-list-item-wrapper.tsx` (nuevo), `tasks-view.tsx` (simplificado)
  - No requiere rebuild (cambio solo en React)
- **Fix Vercel build**: Añadido `installCommand: "npm install --include=dev"` en `vercel.json` para que Vercel instale devDependencies (vite)
- **Fix Git LFS en GitHub Pages y Tauri**: Los archivos adjuntos (imágenes, etc.) trackeados con Git LFS no se mostraban ("File not found")
  - Causa: `resolveGitLfsPointer` y `uploadToGitLfsServer` usaban URLs relativas (`/git-lfs-file`) que solo funcionan en Vercel (app oficial)
  - Fix web: Prepend `VITE_API_BASE_URL` para usar el proxy de Vercel
  - Fix Tauri: Llamadas directas a la API de GitHub LFS (`github.com/{repo}.git/info/lfs/objects/batch`) sin proxy (no hay restricciones CORS)
  - Archivo modificado: `src/utils/git-lfs.ts`
  - No requiere rebuild (cambio solo en React)

### 2026-02-03

- **PWA Update Notifier for iOS**: El verificador de actualizaciones ahora funciona en PWA (no solo Tauri)
  - Eliminada restricción `if (!isTauri())` del hook
  - PWA en iOS home screen ahora verifica `version.json` al abrir
  - Si hay nueva versión y no hay borradores: auto-refresh
  - Si hay borradores: muestra banner para refrescar manualmente
  - Archivo modificado: `use-update-notifier.ts`
  - No requiere rebuild (cambio solo en React)
- **Quick Note Live Preview**: Live preview estilo Obsidian para la ventana Quick Note
  - Headers (`#`) ocultan sintaxis y muestran texto estilizado
  - Bold (`**`) e Italic (`*`, `_`) ocultan marcadores y aplican formato
  - Task checkboxes (`- [ ]`) se renderizan como checkboxes visuales
  - Línea activa muestra markdown crudo para edición
  - Auto-continuación de tareas al presionar Enter
  - Archivos: `live-preview.ts`, `note-editor.tsx`, `quick-note.tsx`
  - No requiere rebuild (cambio solo en React)

### 2026-02-02

- **Hide Completed Tasks Setting**: Nueva preferencia para ocultar tareas completadas en modo lectura
  - Nueva sección "Notes" en Settings con toggle "Hide completed tasks in read mode"
  - Tareas completadas se ocultan en read mode pero siguen visibles en write mode para edición
  - Estado persistido en localStorage via `atomWithStorage`
  - Archivos modificados: `global-state.ts`, `_appRoot.settings.tsx`, `markdown.tsx`, `_appRoot.notes_.$.tsx`
  - No requiere rebuild (cambio solo en React)

### 2026-01-30

- **Merge upstream/main**: Sincronizado con proyecto original (commit fb0546d)
  - Nueva feature: Inline Note Embeds al publicar gists
  - `![[note-id]]` embeds se convierten en blockquotes al publicar
  - Conflict resuelto en `src/utils/gist.ts`: Mantenidas ambas funciones (getApiBaseUrl + prepareNoteForGist)
  - Nuevos archivos: `src/utils/inline-note-embeds.ts` + tests (16 tests)
  - Actualizado `createGist` y `updateGist` para recibir parámetro `notes`
  - No requiere rebuild (cambio solo en React)
- **CI Fix**: Arreglado check de Prettier en GitHub Actions
  - Formateado CONTEXT.md correctamente
  - Agregado `.claude/settings.local.json` a `.prettierignore`
  - Todos los checks del CI ahora pasan (format, lint, test, build)
- **Quick Note Theme Inheritance**: La ventana de nota rápida (⌥⇧N) ahora hereda el tema seleccionado en Settings
  - Imports `themeAtom` y `customThemesAtom` en quick-note.tsx
  - Aplica tema usando misma lógica que app principal (\_appRoot.tsx)
  - Ambas ventanas (main + quick note) mantienen consistencia visual
  - No requiere rebuild (cambio solo en React)
- **Theme Creation UI con Design System**: Mejorada UI de creación de temas personalizados
  - Input de nombre del tema usa `FormControl` + `TextInput` del design system
  - Dropdown de selección de tema reemplazado: `<select>` → `DropdownMenu` component
  - Dropdown tiene mismo estilo que TextInput (border, padding, focus states)
  - Muestra checkmark en tema seleccionado
  - Incluye icono ChevronDown para indicar interactividad
  - No requiere rebuild (cambio solo en React)
- **iOS Home Screen Fix**: Arreglado 404 al abrir web app desde home screen de iOS
  - PWA manifest ahora usa `start_url: "/lumen/"` y `scope: "/lumen/"` para GitHub Pages
  - Condicional basado en env var `GITHUB_PAGES` (consistente con `base` config)
  - Al agregar a home screen, iOS ahora abre la URL correcta sin 404
  - Funciona en modo standalone (sin UI de Safari)
  - No requiere rebuild (cambio solo en configuración de Vite)
- **Favicon Fix**: Agregado favicon link al HTML
  - Añadido `<link rel="icon" type="image/svg+xml" href="/favicon-production.svg" />`
  - El archivo favicon-production.svg ya existía en `/public` pero no estaba referenciado
  - Favicon visible en pestaña del navegador después del deployment
  - No requiere rebuild (cambio solo en HTML estático)

### 2026-01-29

- **Transparent Titlebar**: Eliminado título "Lumen Notes" de la barra, ventana completamente arrastrable
  - `titleBarStyle: "Transparent"` + `hiddenTitle: true` en tauri.conf.json
  - Título oculto, semáforo macOS visible, ventana arrastrable nativamente
  - Trade-off: Área del titlebar tiene ligera diferencia de color visible
  - Nota: Se probaron opciones Overlay + drag regions (no funcionó) y decorations: false (no funcionó)
  - Transparent es la solución funcional por ahora
  - Requiere rebuild de Tauri
- **Theme System (Dark Mode Only)**: Sistema completo de temas con 6 built-in + custom themes
  - **Built-in themes**: Default (Radix), GitHub (Primer), Notion, VS Code, Obsidian, Craft
  - Colores investigados desde fuentes oficiales (Primer, Obsidian docs, Craft brand colors)
  - Sobreescribe ~40 CSS variables derivadas de 8 colores core
  - `color-scheme: dark` forzado (sin light mode)
  - UI en Settings > Appearance (Theme debajo de Font style)
  - **Custom themes en modal**: Diálogo Radix con 8 color inputs + preview
  - **Sync a GitHub repo**: Custom themes se guardan en `.lumen/themes.json` del repo del usuario
    - Al cargar app: Lee desde repo (si existe) o crea archivo desde localStorage
    - Al crear/editar/eliminar theme: Guarda automáticamente a repo
    - Persistencia multi-dispositivo cuando se conecta al mismo repo
  - Arquitectura: 8 colores core → derivación automática de ~40 variantes CSS
- **Version Polling**: Check de versión cada 12h + al recibir foco, auto-refresh si no hay drafts
- **Double Escape**: En modo write, doble Esc guarda y cambia a Read mode
- **Auto-save**: Guardado automático a Git cada 2 minutos en modo write

### 2026-01-28

- Commits iniciales de version polling, double escape y auto-save

### 2026-01-27

- **Tasks View**: Nueva vista `/tasks` en sidebar entre Calendar y Tags
  - Muestra tareas incompletas con búsqueda y filtros por tags
  - Sección de notas que contienen tareas incompletas (grid/list)
- **Priority menu en notas**: Añadido menú de prioridad (High/Medium/Low/None) al dropdown de tareas dentro de las notas
- **Strikethrough para tareas completadas**: Tareas completadas muestran texto tachado y color atenuado
- **Flujo de trabajo actualizado**: CLAUDE.md ahora incluye paso de prueba en dev antes de commit y confirmación antes de push

### 2026-01-26

- **Web OAuth completo**: GitHub Pages + Vercel API funcionando
  - OAuth callback en Vercel (`/github-auth`)
  - CORS proxy con headers para cross-origin (`/cors-proxy`)
  - Vercel despliega desde branch `personal`
- Habilitado DevTools en release builds
- Implementado frontend remoto desde GitHub Pages
- Añadido cache clearing en update refresh
- Configurado basepath para TanStack Router

### Anteriores

- Quick Note con global hotkey (⌥⇧N)
- System Tray (app se minimiza en lugar de cerrar)
- Auto-sync workflow con upstream
- OAuth Device Flow para Tauri
- Links externos en navegador del sistema
