# DESIGN.md

Definiciones de diseno para Lumen. Referencia para mantener consistencia visual.

---

## Branding

### Icono

- **Concepto:** Cerebro/maceta con gradiente coral — representa ideas creciendo
- **Colores:** Gradiente `#F15156` → `#FF715B` sobre fondo `#2B2B2B`
- **Archivos fuente:** `electron/icons/icon.png` (1024x1024)
- **Favicon:** `public/favicon.svg` (SVG con gradiente)

### Nombre

- **App:** Lumen
- **Bundle ID:** `com.lumen.notes`
- **Version:** 0.2.0

---

## Paleta de Colores

Definida en CSS variables (`src/styles/variables.css`). El sistema usa una escala de grises con un color accent.

### Dark Mode (default)

| Token                      | Uso                                                   |
| -------------------------- | ----------------------------------------------------- |
| `--color-bg`               | Fondo principal del contenido                         |
| `--color-bg-secondary`     | Fondo de areas secundarias (titlebar con tabs, cards) |
| `--color-bg-overlay`       | Overlays y dropdowns                                  |
| `--color-text`             | Texto principal                                       |
| `--color-text-secondary`   | Texto secundario (labels, placeholders)               |
| `--color-text-tertiary`    | Texto terciario (hints, timestamps)                   |
| `--color-border-secondary` | Bordes sutiles (separadores, cards)                   |
| `--color-border-focus`     | Accent color (tabs activos, focus rings)              |

### Temas

6 temas built-in + custom themes: Default (Radix), GitHub (Primer), Notion, VS Code, Obsidian, Craft. Los temas sobreescriben las CSS variables.

---

## Tipografia

| Variable                | Uso                           | Default           |
| ----------------------- | ----------------------------- | ----------------- |
| `--font-family-content` | Texto del editor y contenido  | Literata          |
| `--font-family-sans`    | UI (sidebar, buttons, labels) | System font stack |
| `--font-family-mono`    | Codigo en editor              | Monaspace Xenon   |

### Tamanos

| Token              | Valor | Uso                    |
| ------------------ | ----- | ---------------------- |
| `--font-size-xs`   | 11px  | Hints, metadata        |
| `--font-size-sm`   | 12px  | Labels, secondary text |
| `--font-size-base` | 14px  | Body text              |

---

## Layout

### Ventana Principal

- **Min:** 800x600
- **Default:** 1200x800
- **Titlebar:** `hiddenInset` (macOS) — 38px height
- **Sidebar:** 224px (`w-56`), colapsable con `Cmd+Shift+S`

### Titlebar (Desktop)

- **Sin tabs:** `bg-bg` (integrado con contenido)
- **Con tabs:** `bg-bg-secondary` (zona diferenciada)
- **Estructura:** [76px traffic light space] [sidebar toggle + nav] [tabs] [+ button] [drag space]
- **Tab ancho:** 160px fijo
- **Tab activo:** `bg-bg`, texto `text-text`
- **Tab inactivo:** fondo transparente, texto `text-text-secondary`
- **Close button:** Oculto, aparece en hover con gradient fade desde el fondo del tab
- **Iconos tab:** Lucide 12px con strokeWidth 1.75 (opacity-60). CalendarDateIcon custom 11px para daily notes.

### Quick Note (⌥⇧N)

- **Tamano:** 420x320
- **Estilo:** `hiddenInset` titlebar, same `bg-bg` fondo
- **Layout:** [60px traffic light] [centered toggle Note/Inbox] [Save button]
- **Always on top, reusable window**

### Content Area

- **Header:** 40px (`--height-app-header`)
- **Help panel:** Resizable 25-40%, default 30%
- **Responsive:** Help panel oculto < 1024px

---

## Componentes

### Tabs

- **Modelo:** Notion-style — navegacion normal reemplaza tab actual. Solo Cmd+T, + button, Cmd+click crean tabs nuevos.
- **Visibilidad:** Tab bar solo visible cuando hay tabs abiertos
- **Path-based:** Soporta cualquier ruta (/notes, /inbox, /projects, etc.)
- **Persistencia:** `atomWithStorage("open-tabs-v2")` en localStorage
- **Iconos por tipo:** Lucide icons para consistencia visual

### Autocomplete Menus (/, @, [[)

- **Estilo:** DropdownMenu-style con backdrop blur
- **Ancho:** 260px
- **Iconos:** 16px Lucide en seccion headers
- **Tooltips:** Renderizados en `document.body` para soporte de backdrop-filter

### Format Toolbar

- **Trigger:** Aparece al seleccionar texto en write mode
- **Posicion:** Floating via React Portal, `coordsAtPos()` con collision detection
- **Grupos:** Inline (B/I/S/Code) | Blocks (H1-H3/Quote/Code) | Lists (Bullet/Num/Task) | Links

### Slash Commands (/)

- **Estilo:** Notion-style con iconos Lucide
- **Items:** H1, H2, H3, Bullet, Numbered, Todo, Quote, Code, Divider + Templates

---

## Iconos

### App Icons

| Archivo                              | Tamano     | Uso                     |
| ------------------------------------ | ---------- | ----------------------- |
| `electron/icons/icon.png`            | 1024x1024  | App icon (Electron)     |
| `electron/icons/icon.icns`           | Multi-size | macOS app bundle        |
| `electron/icons/trayTemplate.png`    | 22x22      | macOS menu bar          |
| `electron/icons/trayTemplate@2x.png` | 44x44      | macOS menu bar (Retina) |
| `public/favicon.svg`                 | SVG        | Browser tab             |
| `public/icon-1024.png`               | 1024x1024  | PWA                     |
| `public/apple-touch-icon-512.png`    | 512x512    | iOS home screen         |

### Tab Icons

Todos Lucide con `size: 12, strokeWidth: 1.75, opacity: 0.6`:

- Home, Inbox, Calendar, FileText (notes), FolderOpen (projects), ListChecks (tasks), Link, User (people), Tag, Settings
- Excepcion: CalendarDateIcon16 custom (11px) para daily notes con numero del dia

### Tray Icon

- **Naming:** `trayTemplate.png` + `trayTemplate@2x.png`
- **Convention:** macOS auto-pick Retina y dark/light mode via "Template" naming
- **No se necesita** `setTemplateImage(true)` manual

---

## Electron Architecture

### Update Model (Hibrido)

| Cambio                          | Canal                        | Release? |
| ------------------------------- | ---------------------------- | -------- |
| Frontend (React/CSS)            | GitHub Pages (automatico)    | No       |
| Main process (menubar/tray/IPC) | GitHub Release (auto-update) | Si       |

### IPC Channels

| Channel                        | Direccion                  | Uso                         |
| ------------------------------ | -------------------------- | --------------------------- |
| `electron:fetch`               | renderer → main            | CORS-free HTTP              |
| `electron:open-external`       | renderer → main            | Abrir URLs en browser       |
| `electron:close-window`        | renderer → main            | Cerrar ventana actual       |
| `electron:open-in-new-window`  | renderer → main            | Abrir nota en nueva ventana |
| `electron:quick-note-save`     | renderer → main → renderer | Quick note save flow        |
| `electron:get-calendar-events` | renderer → main            | Eventos Calendar.app        |
| `menu-action`                  | main → renderer            | Acciones del menubar        |
| `deep-link`                    | main → renderer            | lumen:// protocol           |
| `navigate-to`                  | main → renderer            | Cmd+click navigation        |
| `quick-note-saved`             | main → renderer            | Confirmacion de save        |

### Security

- `contextIsolation: true` — renderer no tiene acceso a Node.js
- `nodeIntegration: false` — no require() en renderer
- `sandbox: true` — proceso renderer sandboxed
- Preload script expone API minima via `contextBridge`
