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
.env.local           # GitHub PAT (no se sube a git)
```

### Comandos Tauri

```bash
npm run tauri:dev      # Desarrollo con hot reload (abre ventana nativa)
npm run tauri:build    # Build producción → Lumen.app
```

### Remotes

- `origin`: https://github.com/jovotrox/lumen (fork personal)
- `upstream`: https://github.com/lumen-notes/lumen (proyecto original)

### Flujo de Trabajo para Nuevas Features

**IMPORTANTE: Seguir siempre este flujo**

#### 1. Crear branch
```bash
git checkout main
git pull origin main
git checkout -b feature/nombre-feature
```

#### 2. Desarrollar
- Analizar código existente antes de modificar
- Proponer approach y validar con el usuario antes de implementar
- Probar con `npm run tauri:dev`

#### 3. Commit y deploy
```bash
git add .
git commit -m "feat: descripción"
npm run tauri:build
cp -r src-tauri/target/release/bundle/macos/Lumen.app /Applications/
```

#### 4. (Opcional) Contribuir al proyecto original
```bash
git push origin feature/nombre-feature
# Crear PR en GitHub hacia lumen-notes/lumen
```

### Mantener Actualizado con Upstream

Antes de empezar una feature nueva:
```bash
git checkout main
git fetch upstream
git merge upstream/main
git push origin main
```

### Reglas para Claude

1. **Siempre crear branch** antes de modificar código para features
2. **Validar approach** con el usuario antes de implementar cambios significativos
3. **Probar con tauri:dev** antes de hacer build final
4. **Preferir src-tauri/** para código custom cuando sea posible
5. **Mantener compatibilidad** con upstream para facilitar merges futuros
6. **No modificar .env.local** - contiene el GitHub PAT del usuario
