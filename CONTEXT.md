# CONTEXT.md

Este archivo contiene el contexto actual del proyecto para mantener continuidad entre sesiones de Claude Code.

**Última actualización:** 2026-01-28

---

## Estado Actual del Proyecto

### Branch Activo

- **Branch:** `personal`
- **Estado:** Limpio (sin cambios pendientes)
- **Último commit:** `b193e61` - fix: remove move-to-end on task completion

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

| Archivo                                | Tipo de Cambio | Propósito                                |
| -------------------------------------- | -------------- | ---------------------------------------- |
| `src-tauri/*`                          | Nuevo          | Wrapper Tauri completo                   |
| `src/index.tsx`                        | Modificado     | Basepath para GitHub Pages               |
| `src/hooks/use-update-notifier.ts`     | Modificado     | Cache clearing en refresh                |
| `src/routes/quick-note.tsx`            | Nuevo          | Ventana de nota rápida                   |
| `src/routes/_appRoot.tasks.tsx`        | Nuevo          | Vista Tasks con tareas y notas           |
| `src/components/tasks-view.tsx`        | Nuevo          | Componente principal de Tasks            |
| `src/components/nav-items.tsx`         | Modificado     | Añadido link a Tasks en sidebar          |
| `src/components/markdown.tsx`          | Modificado     | Priority menu + strikethrough            |
| `src/components/github-auth-tauri.tsx` | Nuevo          | OAuth Device Flow                        |
| `src/hooks/use-external-links.ts`      | Nuevo          | Links en navegador sistema               |
| `src/utils/tauri.ts`                   | Nuevo          | Utilidades Tauri                         |
| `src/utils/reorder-list-item.ts`       | Modificado     | Función moveListItemToEnd                |
| `.github/workflows/sync-upstream.yml`  | Nuevo          | Auto-sync con upstream                   |
| `.github/workflows/deploy-pages.yml`   | Nuevo          | Deploy a GitHub Pages                    |
| `index.html`                           | Modificado     | SPA redirect handler                     |
| `404.html`                             | Nuevo          | GitHub Pages SPA fallback                |
| `src/utils/themes.ts`                  | Nuevo          | Sistema de temas (definiciones + lógica) |
| `src/routes/_appRoot.settings.tsx`     | Modificado     | Theme selector + custom themes UI        |
| `src/global-state.ts`                  | Modificado     | Atoms para theme + custom themes         |
| `src/routes/_appRoot.tsx`              | Modificado     | Apply theme + titlebar height            |
| `src/components/app-layout.tsx`        | Modificado     | Titlebar padding (collapsed sidebar)     |
| `src/components/sidebar.tsx`           | Modificado     | Titlebar padding + drag region           |
| `src/styles/variables.css`             | Modificado     | --titlebar-height variable               |

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

### 2026-01-28

- **Overlay Titlebar**: Eliminado título "Lumen Notes" de la barra, titlebar transparente con semáforo macOS visible
  - `titleBarStyle: "Overlay"` + `hiddenTitle: true` en tauri.conf.json
  - Padding dinámico (`--titlebar-height: 28px`) para sidebar y contenido principal
  - Drag region en sidebar header para que la ventana sea arrastrable
  - Requiere rebuild de Tauri
- **Theme System**: Sistema completo de temas con 3 built-in (Default, Notion, VS Code) + custom themes
  - Sobreescribe ~40 CSS variables semánticas para light y dark mode
  - UI en Settings > Appearance con dropdown selector
  - Creador de custom themes con 8 color inputs (bg, text, border, accent, etc.) estilo Slack
  - Themes custom se persisten en localStorage
  - Arquitectura: 8 colores core → derivación automática de todas las variantes
- **Version Polling**: Check de versión cada 12h + al recibir foco, auto-refresh si no hay drafts
- **Double Escape**: En modo write, doble Esc guarda y cambia a Read mode
- **Auto-save**: Guardado automático a Git cada 2 minutos en modo write

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
