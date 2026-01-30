# CONTEXT.md

Este archivo contiene el contexto actual del proyecto para mantener continuidad entre sesiones de Claude Code.

**Última actualización:** 2026-01-30

---

## Estado Actual del Proyecto

### Branch Activo

- **Branch:** `personal`
- **Estado:** Limpio (sin cambios pendientes)
- **Último commit:** `40c3936` - fix: iOS home screen start_url for GitHub Pages deployment

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

| Archivo                                | Tipo de Cambio | Propósito                               |
| -------------------------------------- | -------------- | --------------------------------------- |
| `src-tauri/*`                          | Nuevo          | Wrapper Tauri completo                  |
| `src/index.tsx`                        | Modificado     | Basepath para GitHub Pages              |
| `src/hooks/use-update-notifier.ts`     | Modificado     | Cache clearing en refresh               |
| `src/routes/quick-note.tsx`            | Nuevo          | Ventana de nota rápida                  |
| `src/routes/_appRoot.tasks.tsx`        | Nuevo          | Vista Tasks con tareas y notas          |
| `src/components/tasks-view.tsx`        | Nuevo          | Componente principal de Tasks           |
| `src/components/nav-items.tsx`         | Modificado     | Añadido link a Tasks en sidebar         |
| `src/components/markdown.tsx`          | Modificado     | Priority menu + strikethrough           |
| `src/components/github-auth-tauri.tsx` | Nuevo          | OAuth Device Flow                       |
| `src/hooks/use-external-links.ts`      | Nuevo          | Links en navegador sistema              |
| `src/utils/tauri.ts`                   | Nuevo          | Utilidades Tauri                        |
| `src/utils/gist.ts`                    | Modificado     | getApiBaseUrl (Vercel) + inline embeds  |
| `src/utils/inline-note-embeds.ts`      | Upstream       | Inline embeds al publicar gists         |
| `src/utils/reorder-list-item.ts`       | Modificado     | Función moveListItemToEnd               |
| `.github/workflows/sync-upstream.yml`  | Nuevo          | Auto-sync con upstream                  |
| `.github/workflows/deploy-pages.yml`   | Nuevo          | Deploy a GitHub Pages                   |
| `.prettierignore`                      | Modificado     | Ignore .claude/settings.local.json      |
| `index.html`                           | Modificado     | SPA redirect handler                    |
| `404.html`                             | Nuevo          | GitHub Pages SPA fallback               |
| `src/utils/themes.ts`                  | Nuevo          | Sistema de temas (6 built-in + custom)  |
| `src/utils/theme-sync.ts`              | Nuevo          | Sync themes a `.lumen/themes.json`      |
| `src/hooks/use-theme-sync.ts`          | Nuevo          | Hook para sincronizar themes en repo    |
| `src/routes/_appRoot.settings.tsx`     | Modificado     | Theme selector + modal custom themes    |
| `src/global-state.ts`                  | Modificado     | Atoms para theme + custom themes        |
| `src/routes/_appRoot.tsx`              | Modificado     | Apply theme + titlebar + theme sync     |
| `src/components/app-layout.tsx`        | Modificado     | Titlebar padding (collapsed sidebar)    |
| `src/components/sidebar.tsx`           | Modificado     | Titlebar padding + drag + border extend |
| `src/styles/variables.css`             | Modificado     | color-scheme: dark + titlebar height    |
| `vite.config.ts`                       | Modificado     | PWA manifest start_url y scope          |

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
