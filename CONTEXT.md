# CONTEXT.md

Este archivo contiene el contexto actual del proyecto para mantener continuidad entre sesiones de Claude Code.

**Ultima actualizacion:** 2026-04-13 (v0.3.0)

---

## Estado Actual del Proyecto

### Branch Activo

- **Branch:** `personal` (fork personal, rama de compilación)
- **Estado:** Electron v2.0 Phases 1-4 completadas, versioning + pre-commit hooks activos
- **Version:** 0.3.0

### Migracion Tauri → Electron

El proyecto migro de Tauri a Electron como wrapper de escritorio. Tauri tenia limitaciones con WebView macOS (backdrop-filter, CSS rendering) y ecosistema limitado. Electron usa Chromium (consistente) y Node.js/TS (mismo lenguaje que el frontend).

### Arquitectura de Actualizaciones (Modelo Hibrido)

```
┌─────────────────────────────────────────────────────────────┐
│  Lumen.app (Electron)                                       │
│                                                              │
│  BrowserWindow.loadURL("https://jovotrox.github.io/lumen/")│
│                           │                                  │
│                           ▼                                  │
│  ┌─────────────────────────────────────────────────────────┐│
│  │ GitHub Pages (frontend actualizado automaticamente)     ││
│  │ - Desplegado por deploy-pages.yml                       ││
│  │ - Incluye version.json con shell version dinamico       ││
│  └─────────────────────────────────────────────────────────┘│
│                                                              │
│  Main process updates via electron-updater + GitHub Releases │
└─────────────────────────────────────────────────────────────┘
```

| Tipo de cambio                          | Canal                        | Requiere release? |
| --------------------------------------- | ---------------------------- | ----------------- |
| Frontend (React, CSS, features)         | GitHub Pages (automatico)    | No                |
| Main process (menubar, tray, shortcuts) | GitHub Release (auto-update) | Si                |

### Distribucion

| Plataforma          | Distribucion                   | Frontend          |
| ------------------- | ------------------------------ | ----------------- |
| macOS/Windows/Linux | Electron app (GitHub Releases) | Cargado desde URL |
| iOS/Android         | PWA (GitHub Pages)             | Cargado desde URL |
| Browser             | Web app (GitHub Pages)         | Cargado desde URL |

### Configuraciones Clave

#### `electron/main.ts` — Main process

- BrowserWindow: 1200x800, min 800x600, `titleBarStyle: "hiddenInset"`
- System tray: Show/Quick Note/Quit
- Global shortcut: Alt+Shift+N (quick note)
- IPC: fetch (CORS-free), open-external, close-window, quick-note-save, open-in-new-window
- Auto-updater: electron-updater checks every 4h
- Protocol handler: `lumen://`
- Window state persistence (position/size saved to userData)
- Native menubar: Lumen/File/Edit/Format/View/Go/Window/Help

#### `electron-builder.yml` — Packaging

```yaml
appId: com.lumen.notes
productName: Lumen
mac: dmg + zip (universal), protocols: [lumen]
win: nsis (x64 + arm64)
linux: AppImage (x64)
publish: github (jovotrox/lumen)
```

#### `electron/preload.ts` — Secure IPC bridge

Exposes `window.electronAPI` with: isElectron, openExternal, closeWindow, openInNewWindow, quickNoteSave, onQuickNoteSaved, onMenuAction, onDeepLink, onNavigateTo, fetch

---

## Flujo de Sincronizacion

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
                                  │  Electron carga desde URL
                                  ▼
                            Lumen.app (Electron)

            On tag push (v*) ─────┐
                                  │  .github/workflows/electron-release.yml
                                  │  Matrix: macOS + Windows + Linux
                                  ▼
                          GitHub Releases
                          .dmg / .exe / .AppImage
```

---

## Archivos Electron (nuevos en la migracion)

| Archivo                                   | Proposito                                                                            |
| ----------------------------------------- | ------------------------------------------------------------------------------------ |
| `electron/main.ts`                        | Main process: windows, tray, shortcuts, IPC, menubar, auto-updater, protocol handler |
| `electron/preload.ts`                     | Bridge seguro renderer↔main via contextBridge                                       |
| `electron/preload.d.ts`                   | Types para `window.electronAPI`                                                      |
| `electron/tsconfig.json`                  | TS config para IDE                                                                   |
| `electron/icons/*`                        | Iconos de la app (copiados de src-tauri)                                             |
| `electron-builder.yml`                    | Config de empaquetado multiplataforma                                                |
| `src/utils/electron.ts`                   | isElectron(), createElectronHttpClient(), electronFetch()                            |
| `src/components/github-auth-electron.tsx` | Device flow auth via Electron IPC                                                    |
| `src/components/titlebar.tsx`             | Notion-style titlebar con tabs, drag region, traffic light spacing                   |
| `src/components/tab-bar.tsx`              | Tab bar para browser (en desktop se usa titlebar)                                    |
| `src/hooks/use-tabs.ts`                   | Hook para gestion de tabs (openTab, updateActiveTab, closeTab)                       |
| `.github/workflows/electron-release.yml`  | CI/CD para builds multiplataforma                                                    |

## Archivos Modificados para Electron

| Archivo                              | Cambio                                                                                                |
| ------------------------------------ | ----------------------------------------------------------------------------------------------------- |
| `package.json`                       | electron deps, scripts, main field, version 0.2.0                                                     |
| `tsconfig.json`                      | include electron/preload.d.ts                                                                         |
| `.gitignore`                         | electron/dist/, release/                                                                              |
| `src/utils/tauri.ts`                 | isDesktopApp(), openExternal con Electron support                                                     |
| `src/utils/git.ts`                   | isElectron() branch en getHttpConfig()                                                                |
| `src/utils/git-lfs.ts`               | platformFetch() para CORS-free LFS                                                                    |
| `src/hooks/use-external-links.ts`    | guard incluye isElectron()                                                                            |
| `src/routes/quick-note.tsx`          | Electron close/save handlers                                                                          |
| `src/routes/_appRoot.tsx`            | Electron listeners (quick-note, menu-action, deep-link, navigate-to, Cmd+T), route change tab updater |
| `src/routes/_appRoot.notes_.$.tsx`   | updateActiveTab on navigation, "Open in New Window" in context menu                                   |
| `src/components/github-auth.tsx`     | Route a ElectronSignInButton                                                                          |
| `src/components/app-layout.tsx`      | Titlebar integration                                                                                  |
| `src/components/sidebar.tsx`         | Desktop: header hidden (moved to titlebar)                                                            |
| `src/components/page-header.tsx`     | Desktop: nav controls hidden (moved to titlebar)                                                      |
| `src/global-state.ts`                | Tab interface + openTabsAtom                                                                          |
| `.github/workflows/deploy-pages.yml` | Dynamic shell version in version.json                                                                 |

---

## Credenciales y Configuracion

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
# Desarrollo Electron
npm run electron:dev

# Build main process (tsup)
npm run electron:build-main

# Build e instalacion
npm run electron:build       # full build + electron-builder
npm run electron:pack         # build sin crear instalador

# Desarrollo web
npm run dev

# Build web
npm run build

# Tests y calidad
npm run test
npm run lint
npm run format
```

---

## Problemas Conocidos y Soluciones

### Electron no lanza en sandbox (Claude Code)

Electron requiere WindowServer access para inicializar el GUI framework. En entornos sandboxed (como Claude Code CLI), `process.type` es `undefined` y `require('electron')` no resuelve al modulo built-in. Solo se puede testear desde terminal real con `npm run electron:dev`.

### DevTools en Electron

`Cmd+Option+I` o via menu View > Toggle Developer Tools.

### Conflictos en Auto-sync

```bash
git checkout personal
git fetch upstream
git merge upstream/main
# Resolver conflictos manualmente
git commit -m "chore: resolve merge conflicts"
git push origin personal
```

---

## Roadmap / Pendientes

### Rebrand para publicacion masiva (prioridad: media)

El proyecto es un fork MIT de [lumen-notes/lumen](https://github.com/lumen-notes/lumen). Legalmente se puede publicar tal cual (MIT lo permite), pero para masificar como producto propio conviene rebrandear:

**Por que:**

- Evitar confusion con el proyecto original (uselumen.com)
- Establecer identidad propia (el fork ya es significativamente diferente: Electron, tabs, AI, calendar, dashboard, projects/people, etc.)
- Evitar potenciales conflictos de trademark

**Que cambiar:**

- Nombre de la app (Lumen → nuevo nombre)
- Bundle ID: `com.lumen.notes` → `com.<newname>.app`
- Dominio para GitHub Pages
- Referencias en README, CLAUDE.md, CONTEXT.md, DESIGN.md
- Iconos (ya propios — se mantienen)
- `productName` en electron-builder.yml
- Protocol handler: `lumen://` → `<newname>://`
- `app.setName()` en electron/main.ts
- Copyright en LICENSE (agregar linea con autor del fork, mantener original)

**Que mantener:**

- LICENSE original con copyright "Lumen" (MIT lo requiere)
- Credito al proyecto original en README (buena practica)
- Sync con upstream (sigue siendo util para merges)

### Calendar native enhancement (macOS, futuro)

La integración actual es ICS-based (cross-platform, read-only, sin permisos). Para usuarios macOS que quieran integración live con Calendar.app sin pegar URLs manualmente, hay tres opciones evaluadas:

- **A) Swift EventKit embebido en bundle**: pre-compilar el helper a build time y copiarlo a `Lumen.app/Contents/MacOS/` vía `extraResources` de electron-builder. El helper correría como child con el bundleID del padre → TCC puede matchearlo al `NSCalendarsFullAccessUsageDescription`. Complejidad: media.
- **B) `node-mac-permissions` (npm native module)**: corre dentro del proceso Electron → hereda bundleID automáticamente. Complejidad: baja. Contra: native module binary debe matchear Electron ABI.
- **C) AppleScript vía `osascript`**: dispara dialog de **Automation** permission (no Calendars) contra Lumen.app. Funciona unsigned. Contra: lento, requiere Calendar.app abierta, solo Calendar.app (no CalDAV directo).

**Recomendación si se retoma:** Opción B (`node-mac-permissions`) por simplicidad. Pero primero validar que el 90%+ de usuarios estén cubiertos por ICS — si es así, no vale la pena la complejidad native.

**Requisito previo para todas:** code signing (si no, TCC puede seguir comportándose raro aunque bundleID esté ok).

### Otras ideas futuras

- Code signing + notarizacion para macOS (requiere Apple Developer Program)
- Plugin system (expandir tema de themes a behavior)
- Spotlight integration (macOS)
- Backlinks graph view
- Export a PDF/HTML/DOCX

---

## Historial de Cambios Importantes

### v0.3.0 — 2026-04-13

- **feat: Calendar v2 (multi-feed ICS, cross-platform, synced, linked to notes)**
  - Reemplaza la integración EventKit/Swift (rota en macOS 14+ por bundleID nil)
  - **Multi-calendar**: lista de feeds, cada uno con name + URL + color + enabled toggle
  - Palette de 8 colores estilo Apple (FEED_COLORS)
  - Settings UI: lista con inline rename, color swatch clickeable, per-feed toggle, Remove button, Add form con Test
  - Eventos de todos los feeds habilitados se mergean, ordenados por hora (all-day primero)
  - Cada evento muestra el color de su feed
  - Nueva `src/utils/calendar-ics.ts` con parser `ical.js` (soporta RRULE, all-day, webcal://)
  - Funciona en **macOS + Windows + Linux + Web + PWA** (sin permisos de sistema)
  - Usa `electron:fetch` IPC en desktop (bypasa CORS); en browser usa fetch nativo
  - Cache local 5min por URL+fecha
  - **Sincronizado via `.lumen/settings.json`**: `calendarIntegration` + `calendarFeeds` se propagan entre devices (igual que nickname/theme/etc)
  - **Click en evento → nota vinculada**: ID determinístico `event-YYYY-MM-DD-slug-titulo`. Si no existe, se crea con frontmatter (`event.title`, `start`, `end`, `calendar`, `location`, `isAllDay`) + heading. Navega a la nota en write mode. Si existe, abre en read mode. Eventos con nota vinculada muestran ícono FileText (📄).
- **Diagnóstico EventKit confirmó:** binario Swift standalone no puede pedir permisos en macOS 14+ sin bundle
  propio con Info.plist. Solución arquitectónica requiere o embedar Swift en el bundle, o usar
  node-mac-permissions, o AppleScript. **Pospuesto como "plan futuro"** (ver Roadmap).
- **Removido de Electron:**
  - CALENDAR_SWIFT_SRC (~120 líneas de Swift embebido)
  - IPC handler `electron:get-calendar-events` (~110 líneas)
  - `getCalendarEvents` de preload
  - `NSCalendarsUsageDescription` + `NSCalendarsFullAccessUsageDescription` de Info.plist

### v0.2.3 — 2026-04-12

- **fix(electron):** Calendar permission dialog ahora aparece — agregado `NSCalendarsFullAccessUsageDescription` + `NSCalendarsUsageDescription` en `Info.plist` via `extendInfo`
- **fix(electron):** Calendar catch ahora retorna `denied: true` (en vez de tragar el error silenciosamente)
- **fix:** Sidebar Sync/Settings/Help anclados al fondo — `h-full` en scroll container
- **fix(electron):** Quick Note carga instantánea (patrón Spotlight/Alfred)
  - `backgroundColor` + `show: false` + `ready-to-show` → no white flash
  - Close → hide en vez de destroy → React persiste, re-invoke instant
  - Pre-warm al startup (2s delay) → primera invocación también instant
  - IPC `quick-note-reset` limpia state al reabrir
- **Nota post-install:** Si el dialog de Calendar no aparece tras instalar, correr `tccutil reset Calendar com.lumen.notes` (macOS cachea el denial silencioso de versiones anteriores)

### v0.2.2 — 2026-04-12

- **chore:** pre-commit hooks con husky + lint-staged → auto prettier/eslint en archivos staged
- **fix:** CLAUDE.md reformateado (prettier check failing en CI anterior)

### v0.2.1 — 2026-04-12

- **Versioning system** (chore): SemVer rules en CLAUDE.md + `verify-version` job en workflow (falla si la versión no sube antes del merge)
- **fix(electron):** app se demoraba en cerrar por close handler siempre con preventDefault → flag `isQuitting` + `before-quit` listener
- **fix:** sidebar bottom items (sync/settings/help) se subían bajo pinned notes → `min-h-full` en flex container de NavItems
- **feat:** Cmd+, abre Settings (convención macOS)
- **fix(electron):** dock icon cuadrado sin rounded corners en producción → `app.dock.setIcon()` solo en dev (`!app.isPackaged`)

### 2026-04-12

- **Electron v2.0 — Phase 1: Scaffold**

  - Main process en TypeScript con BrowserWindow cargando desde GitHub Pages
  - Preload script con contextBridge para IPC seguro
  - Platform abstraction: isElectron(), createElectronHttpClient(), electronFetch()
  - 8 archivos consumer actualizados (git, git-lfs, auth, quick-note, external-links)
  - electron-builder config para macOS/Windows/Linux
  - Electron 35.7.5 (downgrade de 41 por incompatibilidades)

- **Electron v2.0 — Phase 2: Native Features**

  - Menubar nativo completo: Lumen/File/Edit/Format/View/Go/Window/Help
  - Format menu muestra shortcuts de CodeMirror (registerAccelerator: false)
  - Go menu con navegacion a todas las secciones
  - Auto-updater con electron-updater (checks cada 4h, auto-install on quit)
  - Protocol handler `lumen://` con deep links
  - GitHub Action `electron-release.yml` para builds multiplataforma en tag push
  - Version bump a 0.2.0, dynamic shell version en deploy

- **Electron v2.0 — Phase 3: Tabs + Multi-window**

  - Tab system path-based (soporta cualquier ruta, no solo notas)
  - Notion-style titlebar: drag region, traffic light spacing, tabs integrados
  - Sidebar toggle + nav arrows movidos al titlebar en desktop
  - Tab behavior: navegacion normal reemplaza tab actual, Cmd+T/+/Cmd+click crean tabs nuevos
  - "Open in New Window" en context menu de notas + menu File
  - Window state persistence (posicion/tamano guardados en userData)
  - Dynamic CalendarDateIcon con numero del dia en tabs
  - Close button con gradient fade estilo Notion (visible solo en hover)
  - Iconos Lucide consistentes (12px, strokeWidth 1.75) + CalendarDateIcon16 custom (11px)

- **Electron v2.0 — Phase 4: Premium Features**
  - Ollama local AI: tercer proveedor (sin API key), classify + dashboard summary
  - macOS Calendar.app integration via Swift EventKit (proper permission request)
  - Calendar toggle en Settings (solo despues de login, solo desktop)
  - App icons: nuevo branding cerebro/maceta con gradiente coral
  - Tray icon Retina: trayTemplate.png + trayTemplate@2x.png (macOS Template convention)
  - Favicon SVG actualizado con nuevo diseño
  - Quick Note nativo: hiddenInset titlebar, frameless look, same bg-bg
  - Titlebar adaptivo: bg-bg sin tabs, bg-bg-secondary con tabs

### 2026-04-11

- **Editor Enhancement: Live Preview + Toolbar + Slash Commands + Autocomplete UX**
- **Command Menu (Cmd+K)**: Added Home, Inbox, Projects, Tasks, People
- **Electron v2.0 Migration Plan**: Aprobado y documentado

### 2026-04-10

- **FlowOS Integration — Phases 1-4**: Entities, Smart Inbox, Dashboard, Nudges
- **Visual Polish**: Project/People cards, autocomplete, property values
- **Settings Sync**: .lumen/settings.json for cross-device sync
- **Theme updates**: GitHub, Notion, VS Code, Obsidian refreshed

### Anteriores

- Transparent Titlebar, Theme System, Version Polling, Quick Note, Tasks View
- PWA, iOS Home Screen, OAuth, CI/CD
