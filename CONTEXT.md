# CONTEXT.md

Este archivo contiene el contexto actual del proyecto para mantener continuidad entre sesiones de Claude Code.

**Ultima actualizacion:** 2026-04-13 (v0.5.0)

---

## Estado Actual del Proyecto

### Branch Activo

- **Branch:** `personal` (fork personal, rama de compilación)
- **Estado:** Electron v2.0 Phases 1-4 completadas, versioning + pre-commit hooks activos, native-feel polish v0.5.0
- **Version:** 0.5.0

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

### v0.5.0 — 2026-04-13

- **feat: native-feel polish across the app**
  - **Main window splash**: `BrowserWindow` ahora tiene `backgroundColor: "#111110"` + `show: false` + `ready-to-show` (patrón que ya usaba Quick Note). Además, `index.html` renderiza un splash pre-React con el logo de Lumen centrado en un tono `rgba(255,255,255,0.08)` (apenas más claro que el fondo). React reemplaza el splash al primer render. Adiós flash blanco al abrir la app.
  - **Pinned notes drag-to-reorder**: `@dnd-kit/core` + `@dnd-kit/sortable`. Cada pinned note es sortable vía `useSortable`. `PointerSensor` con `activationConstraint: { distance: 5 }` para no disparar drag en clicks. `DragOverlay` renderiza el duplicado flotante con opacity 0.9 + shadow. Nuevo atom `pinnedOrderAtom` persiste el orden en localStorage y se sincroniza vía `.lumen/settings.json` como `pinnedOrder: string[]`. Pins nuevos (no registrados en el orden) caen al final con el sort por timestamp default.
  - **Web-isms removed**: `select-none` en sidebar root, titlebar, tab-bar, nav-bar mobile, command menu items/headings, dashboard h1/h2. `draggable={false}` en todos los `<img>` del chrome (NoteFavicon covers IMDb/ISBN, WebsiteFavicon). La clase `.nav-item` global también tiene `select-none`.
  - **Scrollbar-hide utility**: plugin nuevo en `tailwind.config.cjs` que define `.scrollbar-hide` cross-browser (`scrollbar-width: none` para Firefox, `::-webkit-scrollbar { display: none }` para Chromium). Antes era una clase usada pero nunca definida — leak de scrollbars default.
  - **EmptyState + Skeleton components**: nuevos componentes compartidos (`src/components/empty-state.tsx`, `src/components/skeleton.tsx`). EmptyState: ícono + título + descripción + CTA opcional, centrado vertical/horizontal. Skeleton: pulse de Tailwind, con helpers `SkeletonText` y `SkeletonListItem`.
  - **Empty states aplicados en**: Projects (no projects + no matches), People (no people + no matches), Inbox (inbox zero + no matches). Dashboard ya tenía su propio empty state (celebratorio con Sparkles) — dejamos intacto.
  - **Skeletons aplicados en**: Calendar events (3 rows durante ICS fetch inicial).

### v0.4.0 — 2026-04-13

- **feat(quick-note): UX polish — native feel**
  - **Spacing & balance (live-preview)**: headers ganan más aire (`0.5x → 0.75x` padding-top, `0.25x → 0.4x` padding-bottom), list/task lines se ajustan (`6px → 4px` vertical) para sentirse más compactos, blockquotes ganan respiración (`2px → 4px`). Afecta Quick Note y notas normales — mejora global consistente.
  - **Container Quick Note**: `pt-2 pb-3 → pt-3 pb-2` para despegar del header draggable.
  - **Traffic lights focus-mode (macOS)**: semáforo oculto al abrir/escribir, visible al mover el mouse sobre la ventana. Nuevo IPC `electron:set-traffic-lights-visible` usando `BrowserWindow.setWindowButtonVisibility`. Renderer usa `window mousemove` (show) + `document keydown` (hide) — NO mouseleave, porque el semáforo está renderizado fuera del DOM en el chrome nativo y un `mouseenter` sobre él dispararía mouseleave del body ocultando los propios botones. Dedup local para evitar IPC chatty.
  - **Pinned format toolbar**: `FormatToolbar` recibe `variant: "floating" | "pinned"`. Pinned skipea Portal + positioning, renderiza inline, siempre visible. Floating conserva el comportamiento actual en notas normales.
  - **Ventana Quick Note**: redimensionada a 460×260 (antes 420×320). Balance más plano, mejor para captura rápida tipo Raycast.
  - **macOS vibrancy blur**: `vibrancy: "under-window"` + `visualEffectState: "active"` + `backgroundColor` transparente. Root del Quick Note usa `color-mix(in srgb, var(--color-bg) 70%, transparent)` para dejar que el blur se vea sin perder legibilidad del texto. Resto de plataformas mantiene bg sólido.
  - **List toggle fix**: `toggleBulletList`/`toggleNumberedList`/`toggleTaskList` ahora detectan cualquier marker de lista existente (`- `, `- [ ] `, `1. `) y lo REEMPLAZAN en vez de apilarlo. Antes, `bullet → numbered` producía `1. - item` (stacked). Ahora reemplaza correctamente. Factorizado en helper `setListKind(view, "bullet"|"numbered"|"task")`.
  - **Iconos del toolbar**: `Quote` (outline molesta) → `TextQuote` (más limpio); wikilink `[[]]` → `AtSign` para match con el pattern de mentions.
  - **Tooltips**: migración de `title` attribute a `<Tooltip>` de base-ui. Cada botón del FormatToolbar muestra label + shortcut (ej. `Bold ⌘B`) al hover, estilo Raycast. Helper local `ToolbarButton` consolida el pattern.
  - **Fullscreen disable**: green traffic button deshabilitado (`fullscreenable: false`). No maximiza ni entra a fullscreen — comportamiento esperado para ventana popup.
  - **Max height 720**: usuario puede redimensionar pero topeado a 720px para evitar Quick Note gigantescos accidentales.
  - **Gradient fade en edges**: `mask-image` en el editor scroll container hace que el texto que sube/baja fade into transparent en vez de cortarse duro contra header/toolbar. Reemplaza el `border-t` de la toolbar — la separación ahora es natural. Replica el patrón del close button en `titlebar.tsx`.
  - **Más transparencia**: tint del overlay bajó 70% → 55%. Deja que se vea más el blur de vibrancy de abajo.
  - **Transparency wiring fix**: el `body { @apply bg-bg }` global de `src/styles/index.css` era opaco y bloqueaba la vibrancy (por eso el 55% no se veía). El route de Quick Note ahora override body/html/#root a `transparent` via efecto. Además `transparent: true` en la BrowserWindow (necesario junto con `vibrancy` para que el blur realmente se componga).
  - **Green button enforcement**: `setMaximizable(false)` + `setFullScreenable(false)` explícitos tras crear la ventana (los constructor options no siempre los respetan con `hiddenInset`). Además listeners defensivos `on("maximize")` + `on("enter-full-screen")` que rebotan al tamaño normal por si algo logra dispararlos.

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
  - **Settings sync env-scoped**: dev escribe `.lumen/settings.dev.json`, prod escribe `.lumen/settings.json`. Dev lee su archivo, con fallback al prod como seed inicial. Así los runs de dev nunca contaminan las preferencias de producción.
  - **Click en evento → nota vinculada**: ID determinístico `event-YYYY-MM-DD-slug-titulo`. Si no existe, se crea con frontmatter (`event.title`, `start`, `end`, `calendar`, `location`, `isAllDay`) + heading. Navega a la nota en write mode. Si existe, abre en read mode. Eventos con nota vinculada muestran ícono FileText (📄).
  - **Refresh:** auto-refresh al reenfocar ventana (window `focus` event) + botón manual "Refresh calendar" en el dropdown `...` de daily notes (solo visible si el toggle master está on). Ambos invalidan el cache Lumen (5min TTL). Nota: el cache del proveedor (Google/iCloud/Outlook) sigue siendo lo que determina cuándo un evento nuevo aparece en el ICS público — típicamente minutos-horas.
  - **UI estilo Things** (daily note view): contenedor `bg-bg-secondary` con padding chico; cada evento es una row con hora en 24h (coloreada con el color del feed, no dot separado), título, y Button "Create note" / "Open note" al reenfocar hover. Sin Clock icon, sin range de hora (solo start).
  - **Event frontmatter property render:** `case "event"` en `property-value.tsx` renderiza el objeto como `[DateLink] · HH:MM–HH:MM · Calendar · Location` en vez del JSON crudo. Compatible con yaml-coerced Date y strings ISO.
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
