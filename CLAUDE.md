# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Lumen is a simple note-taking web application built with React and TypeScript. It enables users to capture and organize their thoughts with features like wikilinks, tags, templates, and GitHub synchronization.

## Development Commands

### Core Development

- `npm run dev:vercel` - Start development server with Vercel Functions
- `npm run build` - Build for production (includes TypeScript compilation)
- `npm run preview` - Preview production build locally

### Testing

- `npm test` - Run all tests once
- `npm run test:watch` - Run tests in watch mode

### Code Quality

- `npm run lint` - Run ESLint on source files
- `npm run format` - Format code with Prettier

### Storybook

- `npm run dev:storybook` - Start Storybook development server
- `npm run build:storybook` - Build Storybook for production
- `npm run test:storybook` - Run Storybook tests
- `npm run test:storybook:watch` - Run Storybook tests in watch mode

### Other

- `npm run benchmark` - Run performance benchmarks

## Architecture

### State Management

- **Global State**: Uses XState state machines with Jotai for global state management (src/global-state.ts)
- **File System**: Integrates with isomorphic-git for Git operations and uses lightning-fs for browser file system
- **GitHub Integration**: Handles authentication, repository cloning, and synchronization

### Key Components

- **Note System**: Notes are parsed from markdown files with frontmatter support
- **Editor**: Built on CodeMirror 6 with custom extensions for wikilinks, frontmatter, and markdown features
- **Routing**: Uses TanStack Router for file-based routing
- **Templates**: Support for note templates with input variables
- **Voice Assistant**: OpenAI integration for voice conversations

### Data Flow

1. Markdown files are stored in a Git repository (GitHub integration)
2. Files are parsed into Note objects with extracted metadata (tags, links, dates)
3. Notes are indexed and made searchable using fast-fuzzy
4. UI components subscribe to state changes via Jotai atoms
5. Changes are automatically synced back to GitHub

### Core Technologies

- **Frontend**: React 18, TypeScript, Vite
- **Styling**: Tailwind CSS with custom design system
- **Editor**: CodeMirror 6 with custom extensions
- **State**: XState + Jotai
- **Git**: isomorphic-git + lightning-fs
- **Routing**: TanStack Router (file-based)
- **UI Components**: Radix UI primitives + Base UI
- **Markdown**: Unified/remark ecosystem

### File Structure

- `src/components/` - React components with Storybook stories
- `src/routes/` - TanStack Router route definitions
- `src/hooks/` - Custom React hooks
- `src/utils/` - Utility functions and helpers
- `src/codemirror-extensions/` - Custom CodeMirror extensions
- `src/remark-plugins/` - Custom remark plugins for markdown processing
- `src/styles/` - CSS files and styling
- `api/` - Vercel Functions

## Development Notes

### Testing

- Uses Vitest for unit tests
- Storybook for component testing and documentation
- Test files should be co-located with source files using `.test.ts` suffix

### Code Style

- Prettier configuration: no semicolons, trailing commas, 100 character line length
- ESLint rules enforced for TypeScript, React, and accessibility

### Before Committing

- Run `npm run format` to format code
- Run `npm run lint` to check for errors

### Git Integration

- The app operates on a Git repository stored in the browser's filesystem
- Uses isomorphic-git for all Git operations
- Automatic synchronization with GitHub repositories

### Performance

- Bundle analysis available via `npm run build` (generates dist/stats.html)
- PWA configuration for offline functionality
- Lazy loading and code splitting implemented

---

## Fork Personal - jovotrox

Este es un fork personal con Electron como wrapper de escritorio (migrado de Tauri en v0.2.0).

### Estructura Adicional

```
electron/            # Electron main process, preload, icons
electron-builder.yml # Configuracion de empaquetado multiplataforma
src-tauri/           # (Legacy) Wrapper Tauri — será removido
.env.local           # GitHub OAuth Client ID (no se sube a git)
```

### Comandos Electron

```bash
npm run electron:dev         # Desarrollo (Vite + Electron concurrente)
npm run electron:build-main  # Compilar main process (tsup)
npm run electron:build       # Build completo (web + electron + empaquetado)
npm run electron:pack        # Build sin crear instalador (para testing)
```

### Remotes

- `origin`: https://github.com/jovotrox/lumen (fork personal)
- `upstream`: https://github.com/lumen-notes/lumen (proyecto original)

### Estrategia de Branches

```
main      ← Sincronizado con upstream (proyecto original)
personal  ← TODAS las features custom + upstream (USAR PARA COMPILAR)
feature/* ← Branches temporales para desarrollo
```

**IMPORTANTE:** La rama `personal` es la rama de compilación. Contiene:

- Todos los cambios del upstream (proyecto original)
- Todas las features custom (font-style, OAuth Device Flow, links externos, etc.)
- Electron desktop wrapper (main process, preload, IPC)

### Features Custom Implementadas

| Feature           | Descripción                                        | Archivos Principales                                                           |
| ----------------- | -------------------------------------------------- | ------------------------------------------------------------------------------ |
| Electron Desktop  | Wrapper nativo macOS/Win/Linux                     | `electron/main.ts`, `electron/preload.ts`                                      |
| Native Menubar    | File/Edit/Format/View/Go/Window/Help               | `electron/main.ts`                                                             |
| Tabs System       | Notion-style tabs en titlebar                      | `src/components/titlebar.tsx`, `src/hooks/use-tabs.ts`                         |
| Auto-updater      | electron-updater + GitHub Releases                 | `electron/main.ts`                                                             |
| Protocol Handler  | lumen:// deep links                                | `electron/main.ts`                                                             |
| Calendar Events   | macOS Calendar.app en daily notes                  | `src/components/calendar-events.tsx`, `src/utils/calendar.ts`                  |
| Ollama AI         | Local AI sin API key                               | `src/utils/ai-classify.ts`, `src/utils/dashboard-ai.ts`                        |
| Font Style        | Setting para cambiar tipografía                    | `src/routes/_appRoot.settings.tsx`                                             |
| OAuth Device Flow | Login GitHub sin servidor                          | `src/components/github-auth-tauri.tsx`                                         |
| Links Externos    | Abrir links en navegador sistema                   | `src/hooks/use-external-links.ts`                                              |
| HTTP sin CORS     | Git operations en Tauri                            | `src/utils/tauri.ts`, `src/utils/git.ts`                                       |
| Quick Note        | Global hotkey ⌥⇧N para notas rápidas               | `src/routes/quick-note.tsx`, `src-tauri/src/lib.rs`                            |
| System Tray       | App se minimiza a tray en lugar de cerrar          | `src-tauri/src/lib.rs`                                                         |
| Auto-sync         | GitHub Action sincroniza con upstream diariamente  | `.github/workflows/sync-upstream.yml`                                          |
| Overlay Titlebar  | Barra transparente sin título, semáforo visible    | `src-tauri/tauri.conf.json`, `src/components/sidebar.tsx`                      |
| Theme System      | Temas Default/Notion/VS Code + custom themes       | `src/utils/themes.ts`, `src/routes/_appRoot.settings.tsx`                      |
| Version Polling   | Check cada 12h + al enfocar, auto-refresh          | `src/hooks/use-update-notifier.ts`                                             |
| Double Escape     | Doble Esc en write mode → save + read mode         | `src/routes/_appRoot.notes_.$.tsx`                                             |
| Auto-save         | Guardado automático cada 2 min en write mode       | `src/routes/_appRoot.notes_.$.tsx`                                             |
| FlowOS Entities   | Project/Person note types via frontmatter          | `src/schema.ts`, `src/utils/parse-note.ts`, `src/global-state.ts`              |
| Projects View     | /projects page con status, owner, task progress    | `src/components/projects-view.tsx`, `src/routes/_appRoot.projects.tsx`         |
| People View       | /people page con roles y task counts               | `src/components/people-view.tsx`, `src/routes/_appRoot.people.tsx`             |
| Mention Picker    | @ y [[ triggers con entity picker agrupado         | `src/components/note-editor.tsx`                                               |
| Smart Inbox       | Quick Note dual mode + /inbox con AI classify      | `src/routes/quick-note.tsx`, `src/components/inbox-view.tsx`                   |
| AI Classification | OpenAI/Claude/heuristic para clasificar inbox      | `src/utils/ai-classify.ts`, `src/routes/_appRoot.settings.tsx`                 |
| Inbox UX          | Convert dropdown, badges, pre-classify, task→daily | `src/components/inbox-view.tsx`                                                |
| FM Autocomplete   | Frontmatter value suggestions in editor + props    | `src/components/note-editor.tsx`, `src/components/property-value.tsx`          |
| Home Dashboard    | Morning briefing: date, weather, greeting, actions | `src/components/dashboard-view.tsx`, `src/routes/_appRoot.index.tsx`           |
| Dashboard AI      | AI summary via OpenAI/Claude + template fallback   | `src/utils/dashboard-ai.ts`, `src/utils/dashboard-templates.ts`                |
| Nudges            | Stale tasks, inactive projects, overdue, inbox     | `src/utils/nudges.ts`, `src/global-state.ts`                                   |
| Weather           | wttr.in integration, C/F toggle in settings        | `src/components/dashboard-view.tsx`, `src/routes/_appRoot.settings.tsx`        |
| Settings Sync     | .lumen/settings.json syncs prefs across devices    | `src/utils/settings-sync.ts`, `src/hooks/use-settings-sync.ts`                 |
| Live Preview      | WYSIWYG editing con dim markers en línea activa    | `src/codemirror-extensions/live-preview.ts`                                    |
| Format Toolbar    | Floating toolbar al seleccionar texto              | `src/components/format-toolbar.tsx`                                            |
| Format Shortcuts  | Cmd+B bold, Cmd+I italic, etc.                     | `src/codemirror-extensions/format-keymap.ts`                                   |
| Slash Commands    | / menu Notion-style con íconos Lucide              | `src/components/note-editor.tsx`                                               |
| Autocomplete UX   | Backdrop blur + íconos en /, @, [[ menus           | `src/codemirror-extensions/autocomplete-theme.ts`, `src/styles/codemirror.css` |

### Flujo de Trabajo (PR-based)

**Todo cambio va por Pull Request. No se hace merge local + push directo a `personal`.**

El flujo completo vive en skills dedicadas para no llenar este archivo:

- **`create-pr`** — branch + dev + test + version bump + CONTEXT.md + abrir PR
- **`release`** — fallback MANUAL para cuando el workflow automatizado de release falla (casi nunca se usa)

Claude debe invocar la skill `create-pr` al empezar cualquier cambio. **Tras el squash merge, no hay que hacer nada manualmente** — el workflow `electron-release.yml` se dispara solo y `electron-builder --publish always` crea el tag `v<VERSION>` + el GitHub Release (con DMG/nsis/AppImage) en el mismo paso (~3-5 min).

Razones del PR flow:

- Historial trazable en GitHub (diff viewer, comments, code review)
- CI corre antes del merge (safety net)
- `personal` queda limpio con squash merges (1 commit por feature)
- PRs pueden cerrarse sin merge si algo está mal

**Pre-commit hook:** husky + lint-staged corre prettier + eslint --fix automáticamente. No hace falta `npm run format` manual.

**Electron local** (solo para testing rápido de cambios en `electron/main.ts` o `preload.ts`):

```bash
npm run electron:build-main
npm run electron:pack
```

Cambios React/TypeScript/CSS: hot reload en dev, GitHub Pages en prod — no requieren rebuild del main process.

### Sincronización con Upstream (Automatizada)

El fork tiene un **GitHub Action** que sincroniza automáticamente con el proyecto original:

- **Frecuencia:** Diariamente a las 6:00 UTC
- **Workflow:** `.github/workflows/sync-upstream.yml`
- **Trigger manual:** Actions → "Sync with Upstream" → Run workflow

**Flujo automático:**

1. El Action hace fetch de `upstream/main`
2. Merge automático a `personal` branch
3. Push a origin
4. El workflow `deploy-pages.yml` se activa y despliega

**Si el auto-merge falla (conflictos):**

```bash
git checkout personal
git fetch upstream
git merge upstream/main
# Resolver conflictos manualmente
git add .
git commit -m "chore: resolve merge conflicts with upstream"
git push origin personal
```

### Actualización Manual (Opcional)

Si prefieres actualizar manualmente:

```bash
# 1. Fetch y merge upstream a personal
git checkout personal
git fetch upstream
git merge upstream/main --no-edit
git push origin personal
```

### Reglas para Claude

1. **Siempre trabajar desde `personal`** - Es la rama con todas las features
2. **NUNCA EDITAR ARCHIVOS DIRECTAMENTE EN `personal`** - Esto incluye TODO tipo de cambio: features, fixes, config, docs, vercel.json, CONTEXT.md updates, CUALQUIER archivo. No hay excepciones. No importa si es "solo un fix pequeño" o "solo un cambio de config". SIEMPRE crear feature branch primero: `git checkout -b feature/nombre`. Si se aprueba un plan, lo primero es crear el branch. Si hay que hacer un hotfix, crear branch. Si hay que actualizar docs, crear branch. SIEMPRE.
3. **NUNCA hacer merge local a `personal`** - Todos los merges van por Pull Request en GitHub. El flujo es: push branch + `gh pr create --base personal` + review + squash merge en GitHub UI.
4. **Validar approach** con el usuario antes de implementar cambios significativos
5. **Probar con electron:dev** antes de hacer build final
6. **Mantener compatibilidad** con upstream para facilitar merges futuros
7. **No modificar .env.local** - contiene el GitHub OAuth Client ID del usuario
8. **Compilar siempre desde `personal`** - Garantiza que la app tenga TODAS las features. **El release es 100% automático**: tras el squash merge a `personal`, `electron-release.yml` dispara electron-builder que crea el tag + GitHub Release en un solo paso. No hay que taguear manualmente.
9. **OBLIGATORIO: Actualizar CONTEXT.md** después de cada feature nueva o fix de errores importantes - ANTES de abrir el PR. Sin excepciones.
10. **Confirmar antes de abrir el PR** - SIEMPRE pedir confirmación al usuario antes de ejecutar `gh pr create`. Mostrar resumen de cambios, title propuesto y body.
11. **OBLIGATORIO: Bumpear versión antes del PR** (si toca `electron/**`, `electron-builder.yml`, o `package.json`) - Ver sección "Versionado". El workflow FALLA si la versión no sube.
12. **NO taguear manualmente tras el merge** - electron-builder lo hace solo. Si por alguna razón el workflow falla y hay que intervenir manualmente, ver la skill `release` como fallback documentado.

---

## Versionado (SemVer)

**Por qué importa:** `electron-updater` compara `package.json.version` con la última release en GitHub. Si la versión no sube, **el auto-update no detecta updates nuevos** y los usuarios se quedan con la versión vieja. Además, dos releases con la misma versión colisionan en GitHub Releases.

### Reglas de bump

Formato: `MAJOR.MINOR.PATCH` (ej: `0.3.1`)

| Tipo de cambio                                   | Bump      | Ejemplo           |
| ------------------------------------------------ | --------- | ----------------- |
| `fix:`, `chore:`, `docs:`, `refactor:`, `style:` | **PATCH** | `0.2.0` → `0.2.1` |
| `feat:` (feature visible al usuario)             | **MINOR** | `0.2.0` → `0.3.0` |
| Breaking change, rebrand, nueva arquitectura     | **MAJOR** | `0.x.y` → `1.0.0` |

**Si el branch tiene commits mixtos** (ej: 2 `fix:` + 1 `feat:`), gana el más alto — en ese caso, MINOR.

### Cuándo bumpear

**SIEMPRE antes del merge a `personal`**, cuando el branch va a disparar el workflow de release. Esto ocurre si el branch toca cualquiera de:

- `electron/**`
- `electron-builder.yml`
- `package.json`

Si el branch es solo web (React/CSS/utils), **no es necesario bumpear** — no se dispara release de Electron.

### Proceso

En el último commit del feature branch (antes de merge):

```bash
# 1. Determinar el bump leyendo los commits del branch
git log personal..HEAD --oneline

# 2. Editar package.json — campo "version"
# 3. Commit el bump EN EL FEATURE BRANCH (antes de abrir el PR)
git add package.json
git commit -m "chore: bump version to 0.3.0"

# 4. Push branch + abrir PR (flujo normal)
git push -u origin feature/nombre-feature
gh pr create --base personal --head feature/nombre-feature \
  --title "..." --body "..."

# 5. Usuario revisa y hace Squash and merge en GitHub UI
# 6. LISTO — electron-release.yml corre solo, electron-builder publica el
#    GitHub Release con tag v<VERSION> sobre el squash commit.
#    ~3-5 min y está live. No requiere ninguna acción manual.
```

**El workflow `electron-release.yml` tiene dos jobs:**

1. `verify-version` — falla fast si `v<VERSION>` ya existe como release (protege contra olvidar el bump)
2. `build` matrix (mac/linux/win) corre `npx electron-builder --publish always`. Con `publish.provider: github` + `releaseType: release` en `electron-builder.yml`, electron-builder **crea el tag + el GitHub Release + sube los assets en el mismo paso**.

**No hay que taguear manualmente.** Si lo hacés, en el mejor caso es no-op; en el peor, podés apuntar a un commit equivocado. La skill `release` sólo existe como fallback documentado si el workflow falla y hay que intervenir a mano.

### Changelog

Cada bump debe agregar una entrada a `CONTEXT.md` en el historial, formato:

```markdown
### v0.3.0 — 2026-04-12

- feat(...): descripción
- fix(...): descripción
```

### Reglas para Claude

1. **Verificar versión antes del PR**: leer `package.json.version` y comparar con el último tag (`git describe --tags --abbrev=0`). Si son iguales y el branch toca archivos de Electron, proponer bump.
2. **Proponer el bump correcto**: leer los commits del branch con `git log personal..HEAD --oneline` y sugerir PATCH/MINOR/MAJOR según la tabla.
3. **Nunca abrir PR sin bump** si el branch dispara release — el workflow va a fallar igual, mejor evitarlo de raíz.
4. **NO taguear manualmente tras el squash merge** — electron-builder crea el tag + release en el workflow automático. La skill `release` es sólo fallback para cuando el workflow falla.
5. **Actualizar CONTEXT.md** con la entrada de la nueva versión antes de abrir el PR.

---

## Mantenimiento de CONTEXT.md

El archivo `CONTEXT.md` contiene el contexto actual del proyecto para mantener continuidad entre sesiones de Claude Code.

### Cuándo Actualizar

Actualizar `CONTEXT.md` después de:

- Completar una feature nueva
- Cambios en la arquitectura o configuración
- Resolver problemas importantes
- Cambios en el flujo de trabajo o sincronización
- Nuevas credenciales o configuraciones

### Qué Incluir

- Estado actual del branch y último commit relevante
- Archivos modificados respecto al upstream
- Configuraciones clave
- Problemas conocidos y soluciones
- Historial de cambios importantes con fecha

### Formato

Mantener las secciones existentes y agregar al historial de cambios con la fecha actual.
