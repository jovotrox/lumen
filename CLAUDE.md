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

| Feature | Descripción | Archivos Principales |
|---------|-------------|---------------------|
| Tauri Desktop | Wrapper nativo macOS | `src-tauri/*` |
| Font Style | Setting para cambiar tipografía | `src/routes/_appRoot.settings.tsx` |
| OAuth Device Flow | Login GitHub sin servidor | `src/components/github-auth-tauri.tsx` |
| Links Externos | Abrir links en navegador sistema | `src/hooks/use-external-links.ts` |
| HTTP sin CORS | Git operations en Tauri | `src/utils/tauri.ts`, `src/utils/git.ts` |
| Quick Note | Global hotkey ⌥⇧N para notas rápidas | `src/routes/quick-note.tsx`, `src-tauri/src/lib.rs` |
| System Tray | App se minimiza a tray en lugar de cerrar | `src-tauri/src/lib.rs` |
| Auto-sync | GitHub Action sincroniza con upstream diariamente | `.github/workflows/sync-upstream.yml` |

### Flujo de Trabajo para Nuevas Features

**IMPORTANTE: Seguir siempre este flujo**

#### 1. Crear branch desde personal
```bash
git checkout personal
git pull origin personal
git checkout -b feature/nombre-feature
```

#### 2. Desarrollar
- Analizar código existente antes de modificar
- Proponer approach y validar con el usuario antes de implementar
- Probar con `npm run tauri:dev`

#### 3. Commit y merge a personal
```bash
git add .
git commit -m "feat: descripción"
git checkout personal
git merge feature/nombre-feature --no-edit
git push origin personal
```

#### 4. Compilar e instalar
```bash
npm run tauri:build
cp -r src-tauri/target/release/bundle/macos/Lumen.app /Applications/
```

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
2. **Crear feature branch** antes de modificar código para features nuevas
3. **Validar approach** con el usuario antes de implementar cambios significativos
4. **Probar con tauri:dev** antes de hacer build final
5. **Merge a personal** después de completar cada feature
6. **Mantener compatibilidad** con upstream para facilitar merges futuros
7. **No modificar .env.local** - contiene el GitHub OAuth Client ID del usuario
8. **Compilar siempre desde `personal`** - Garantiza que la app tenga TODAS las features
9. **Actualizar CONTEXT.md** después de cambios importantes (ver sección abajo)

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
