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
| `--color-bg-sidebar`       | Fondo del sidebar (ligeramente mas claro que bg)      |
| `--color-bg-overlay`       | Overlays y dropdowns                                  |
| `--color-text`             | Texto principal                                       |
| `--color-text-secondary`   | Texto secundario (labels, placeholders)               |
| `--color-text-tertiary`    | Texto terciario (hints, timestamps)                   |
| `--color-border-secondary` | Bordes sutiles (separadores, cards)                   |
| `--color-border-focus`     | Accent color (tabs activos, focus rings)              |

### Temas

6 temas built-in + custom themes: Default (Radix), GitHub (Primer), Notion, VS Code, Obsidian, Craft. Los temas sobreescriben las CSS variables.

### Convencion de clases Tailwind para colores

Los colores de fondo estan definidos bajo `colors.bg` en `tailwind.config.cjs`. Esto significa que la clase Tailwind incluye el prefijo `bg-bg-`:

| CSS Variable           | Clase Tailwind    | **NO** usar    |
| ---------------------- | ----------------- | -------------- |
| `--color-bg`           | `bg-bg`           |                |
| `--color-bg-secondary` | `bg-bg-secondary` | `bg-secondary` |
| `--color-bg-sidebar`   | `bg-bg-sidebar`   | `bg-sidebar`   |
| `--color-bg-card`      | `bg-bg-card`      | `bg-card`      |
| `--color-bg-overlay`   | `bg-bg-overlay`   | `bg-overlay`   |

Esto ocurre porque Tailwind combina el prefijo de utilidad (`bg-`) con el path del color (`bg.sidebar`), resultando en `bg-bg-sidebar`. El mismo patron aplica para text (`text-text-secondary`) y border (`border-border-secondary`).

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
- **Sidebar:** 224px (`w-56`), colapsable con `Cmd+Shift+S`, `bg-bg-sidebar`

### Sidebar (Desktop)

- **Background:** `bg-bg-sidebar` — ligeramente mas claro que `bg-bg` (Notion pattern)
- **Posicion:** Full height (de arriba a abajo de la ventana, sibling del content column)
- **Top area (macOS):** [70px traffic light space] [New note button con label]
- **Borde:** `border-r border-border-secondary`
- **Contenido:** NavItems con scroll

### Titlebar (Desktop)

- **Sin tabs:** `bg-bg` (integrado con contenido)
- **Con tabs:** `bg-bg-secondary` (zona diferenciada)
- **Estructura:** [sidebar toggle] [back] [forward] [tabs] [+ button] [drag space]
- **Traffic light spacer:** Solo cuando sidebar esta collapsed (76px). Cuando expanded, el sidebar maneja el espacio.
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

## Carousel Card Grid System

El dashboard usa carruseles horizontales con scroll. Los anchos de las cards siguen un sistema de 3 tamanos basado en un modulo de 200px:

| Size | Ancho | Relacion | Uso                                  | Clase Tailwind |
| ---- | ----- | -------- | ------------------------------------ | -------------- |
| `sm` | 200px | 1x       | Items compactos: notas recientes     | `w-[200px]`    |
| `md` | 280px | 1.4x     | Items con metadata: proyectos        | `w-[280px]`    |
| `lg` | 360px | 1.8x     | Items detallados: reservado a futuro | `w-[360px]`    |

### Reglas

- **Gap entre cards:** `gap-3` (12px)
- **Snap behavior:** `snap-x` (suave, no mandatory) + `snap-start` en cada card
- **Scroll indicator:** Gradientes laterales (`w-6`) que aparecen/desaparecen segun posicion de scroll. El gradiente izquierdo NO aparece en estado inicial.
- **Cards:** `card-1 rounded-lg overflow-hidden` como base. Sin hover outline (el scroll lo hace innecesario).
- **Aspect ratio:** Las cards `sm` usan `aspect-[5/3]` via NotePreview. Las cards `md` y `lg` usan alto flexible (contenido + footer).
- **Section header:** Titulo con icono a la izquierda, link "View all →" alineado a la derecha en la misma linea.
- **Componente compartido:** `RecentCarousel` maneja el scroll container, gradientes, y deteccion de posicion.

### Cuando usar cada tamano

- **`sm`** — El item se entiende con solo titulo/preview. No necesita metadata adicional visible (ej: notas, links).
- **`md`** — El item necesita metadata: status badge, progress bar, deadline, owner (ej: proyectos, tareas agrupadas).
- **`lg`** — El item necesita un preview extendido o multiples secciones de metadata (ej: dashboards embebidos, weekly summaries). Reservado a futuro.

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
