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

Este es un fork personal con Tauri como wrapper de escritorio para macOS.

### Estructura Adicional

```
src-tauri/           # Wrapper Tauri (código custom, no del upstream)
.env.local           # GitHub OAuth Client ID para Tauri (no se sube a git)
```

### Comandos Tauri

```bash
npm run tauri:dev      # Desarrollo con hot reload (abre ventana nativa)
npm run tauri:build    # Build producción → Lumen.app
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
- Código Tauri para desktop

### Features Custom Implementadas

| Feature           | Descripción                                        | Archivos Principales                                                           |
| ----------------- | -------------------------------------------------- | ------------------------------------------------------------------------------ |
| Tauri Desktop     | Wrapper nativo macOS                               | `src-tauri/*`                                                                  |
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

### Flujo de Trabajo para Nuevas Features

**OBLIGATORIO: Seguir siempre este flujo. No se puede saltar ningún paso.**

#### 1. Crear branch desde personal (ANTES de cualquier edición)

**Este paso es BLOQUEANTE. No se puede editar ningún archivo sin haber creado el branch primero.**

```bash
git checkout personal
git pull origin personal
git checkout -b feature/nombre-feature
```

#### 2. Desarrollar

- Analizar código existente antes de modificar
- Proponer approach y validar con el usuario antes de implementar

#### 3. Probar antes de commit

```bash
npm run build          # Verificar que compila sin errores
npm run format         # Formatear código
npm run lint           # Verificar linting
```

- Iniciar dev server para que el usuario pruebe: `npm run dev`
- Esperar confirmación del usuario de que funciona correctamente

#### 4. Commit y merge a personal

```bash
git add <archivos-específicos>
git commit -m "feat: descripción"
git checkout personal
git merge feature/nombre-feature --no-edit
```

#### 5. Confirmar y push

- **SIEMPRE pedir confirmación al usuario antes de push**
- Mostrar resumen de cambios (archivos modificados, descripción)

```bash
git push origin personal
```

#### 6. Actualizar CONTEXT.md (OBLIGATORIO)

**SIEMPRE** actualizar `CONTEXT.md` después del merge, ANTES del push:

- Estado actual del branch y último commit
- Archivos nuevos/modificados en la tabla
- Entrada en el historial de cambios con fecha
- Pendientes para futuras sesiones

#### 7. Compilar Tauri (si aplica)

Solo si los cambios requieren recompilación de la app nativa (cambios que no llegan via web refresh):

- Cambios en `src-tauri/*`
- Cambios en configuración de Tauri
- Nuevas dependencias nativas

```bash
npm run tauri:build
cp -r src-tauri/target/release/bundle/macos/Lumen.app /Applications/
```

**Nota:** Cambios en React/TypeScript/CSS se reciben automáticamente via GitHub Pages (web) o hot reload (dev).

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

# 2. Compilar nueva versión
npm run tauri:build
cp -r src-tauri/target/release/bundle/macos/Lumen.app /Applications/
```

### Reglas para Claude

1. **Siempre trabajar desde `personal`** - Es la rama con todas las features
2. **OBLIGATORIO: Crear feature branch ANTES de cualquier edición de código** - NUNCA editar archivos directamente en `personal`. El primer paso antes de escribir cualquier línea de código es `git checkout -b feature/nombre`. Si se aprueba un plan, lo primero es crear el branch. Sin excepciones.
3. **Validar approach** con el usuario antes de implementar cambios significativos
4. **Probar con tauri:dev** antes de hacer build final
5. **Merge a personal** después de completar cada feature
6. **Mantener compatibilidad** con upstream para facilitar merges futuros
7. **No modificar .env.local** - contiene el GitHub OAuth Client ID del usuario
8. **Compilar siempre desde `personal`** - Garantiza que la app tenga TODAS las features
9. **OBLIGATORIO: Actualizar CONTEXT.md** después de cada feature nueva o fix de errores importantes - SIEMPRE actualizar antes de terminar la sesión. Sin excepciones.
10. **Confirmar antes de hacer push** - SIEMPRE pedir confirmación al usuario antes de ejecutar `git push`

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
