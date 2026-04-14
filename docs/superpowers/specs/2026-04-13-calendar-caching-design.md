# Calendar caching, prefetch, and animations — design

**Date:** 2026-04-13
**Status:** Approved (pending implementation)
**Target version:** v0.7.0 (MINOR bump from v0.6.0)
**Branch:** `feature/calendar-caching`

---

## Context

El feed de calendar (ICS) en daily notes hoy tiene tres fricciones que rompen la sensación nativa:

1. **Cold start lento**: cada apertura de Lumen vuelve a fetchear todos los feeds (cache es in-memory, se pierde con el reload). Skeleton durante 1-3s.
2. **Navegación entre días lenta**: cada día abre con su propio fetch, no se anticipa la navegación día a día (que es 95% del flujo real).
3. **Sin animaciones**: los eventos aparecen y desaparecen abruptamente; no hay feedback visual cuando el revalidate trae cambios.

Estado actual relevante (`src/utils/calendar.ts`):

- Cache `Map<string, {result, timestamp, ttl}>` en memoria, TTL 5min success / 30s error
- En `focus` se invalida todo y se re-fetchea (force refresh)
- 3 feeds enabled × 1 día = 3 fetches en cada day open

Decisión: atacar los tres problemas en una sola PR usando **stale-while-revalidate** (SWR pattern) con **persistencia en IndexedDB** y **prefetch ±3 días**.

---

## Goals

- **Day open instant** cuando hay cache (nuevo o de sesión anterior)
- **Navegación día a día sin esperas** dentro de una ventana de ±3 días
- **Animaciones sutiles** (120ms fade + layout transition) cuando llegan cambios reales
- **Sin spam de red**: feeds no se fetchean más de 1× cada 5min en background prefetch
- **Sin afectar otros flows**: el código existente de parsing ICS y handling de errores se conserva

## Non-goals

- Sync entre devices del cache (cada device tiene el suyo en IndexedDB)
- Vista mensual / vista de semana del calendar (sigue siendo solo por daily note)
- Botón manual de refresh (el revalidate automático cubre el caso)
- Notificaciones de eventos próximos
- Edición/creación de eventos en feeds (read-only sigue)
- Soporte de calendarios CalDAV con auth (ICS público sigue siendo el único transport)

---

## Architecture

Tres capas con responsabilidades aisladas:

```
┌─────────────────────────────────────────────────────────┐
│ <CalendarEvents dateString=...>  (UI + animaciones)     │
│   - useCalendarEvents(dateString) hook                  │
│   - <motion.div layout> + <AnimatePresence>             │
└──────────────────────┬──────────────────────────────────┘
                       │ pide eventos para una fecha
                       ▼
┌─────────────────────────────────────────────────────────┐
│ useCalendarEvents(date) — hook (src/hooks/)             │
│   - Lee cache de IndexedDB (instant)                    │
│   - Revalida en background (siempre)                    │
│   - Dispara prefetch ±3 días alrededor                  │
│   - Subscribe a invalidations (focus, feed change)      │
└──────────────────────┬──────────────────────────────────┘
                       │ usa
                       ▼
┌─────────────────────────────────────────────────────────┐
│ calendar-cache.ts — capa de persistencia                │
│   - getCachedEntry(feedUrl, date)                       │
│   - setCachedEntry(feedUrl, date, entry)                │
│   - evictOutsideRange(validUrls, minDate, maxDate)      │
│   - clearCalendarCache()                                │
│   - Storage: idb-keyval con namespace propio            │
└─────────────────────────────────────────────────────────┘
```

**Boundaries:**

- `calendar-cache.ts` solo sabe de leer/escribir/listar. No conoce feeds, fetches ni TTL. Es un key-value store tipado.
- `useCalendarEvents` orquesta SWR: lee cache, dispara fetch, hace prefetch, escucha invalidations.
- `<CalendarEvents>` solo renderiza + anima. Recibe `{events, errors, isLoading, isRevalidating}` del hook.

El cache **in-memory actual desaparece** — IndexedDB es lo suficientemente rápido (~1-3ms por read) y elimina la duplicación.

---

## Module: `src/utils/calendar-cache.ts` (NEW)

```ts
import { get, set, del, keys, createStore } from "idb-keyval"
import type { CalendarEvent } from "./calendar"

const CACHE_VERSION = "v1"
const store = createStore("lumen-calendar-cache", "events")

export interface CachedEntry {
  events: CalendarEvent[] // ya parseados
  fetchedAt: number // Date.now()
  error?: string // si el último fetch falló
}

function makeKey(feedUrl: string, dateString: string): string {
  return `${CACHE_VERSION}::${feedUrl}::${dateString}`
}

export async function getCachedEntry(
  feedUrl: string,
  dateString: string,
): Promise<CachedEntry | undefined> {
  return get(makeKey(feedUrl, dateString), store)
}

export async function setCachedEntry(
  feedUrl: string,
  dateString: string,
  entry: CachedEntry,
): Promise<void> {
  return set(makeKey(feedUrl, dateString), entry, store)
}

export async function clearCalendarCache(): Promise<void> {
  const allKeys = await keys(store)
  await Promise.all(allKeys.map((k) => del(k, store)))
}

/**
 * Borra entries de feeds que ya no existen y/o fechas fuera de la ventana actual.
 * Se llama después de cada prefetch para mantener IndexedDB chico.
 */
export async function evictOutsideRange(
  validFeedUrls: Set<string>,
  minDate: string,
  maxDate: string,
): Promise<void> {
  const allKeys = (await keys(store)) as string[]
  const toDelete = allKeys.filter((key) => {
    const [version, feedUrl, date] = key.split("::")
    if (version !== CACHE_VERSION) return true // versión vieja
    if (!validFeedUrls.has(feedUrl)) return true // feed eliminado
    if (date < minDate || date > maxDate) return true // fuera de ventana
    return false
  })
  await Promise.all(toDelete.map((k) => del(k, store)))
}
```

**Decisiones:**

- Cache **por feed individual**, no por "todos los feeds del día". Si agregas un feed nuevo, los otros no se invalidan.
- Guardamos `events` ya parseados (no ICS raw) para amortizar el parsing CPU-pesado.
- `CACHE_VERSION` en la key permite bumpear shape sin migración manual: keys viejas se ignoran y se eliminan en el primer evict.

---

## Module: `src/hooks/use-calendar-events.ts` (NEW)

Hook que orquesta cache, fetch, prefetch e invalidations.

```ts
import { useEffect, useState } from "react"
import { useAtomValue } from "jotai"
import { calendarFeedsAtom, calendarIntegrationAtom } from "../global-state"
import { getCachedEntry, setCachedEntry, evictOutsideRange } from "../utils/calendar-cache"
import { fetchIcsEvents } from "../utils/calendar-ics"
import type { CalendarEvent, CalendarFeed } from "../utils/calendar"

const PREFETCH_RADIUS_DAYS = 3
const PREFETCH_FRESH_MS = 5 * 60_000

export interface UseCalendarEventsResult {
  events: CalendarEvent[]
  errors: Array<{ feedName: string; message: string }>
  isLoading: boolean // true SOLO si no hay cache (cold path)
  isRevalidating: boolean // true durante background refetch
}

export function useCalendarEvents(dateString: string): UseCalendarEventsResult {
  const enabled = useAtomValue(calendarIntegrationAtom)
  const feeds = useAtomValue(calendarFeedsAtom)
  const activeFeeds = feeds.filter((f) => f.enabled && f.url)
  const feedKey = JSON.stringify(activeFeeds.map((f) => [f.id, f.url, f.color, f.name]))
  const focusTick = useFocusInvalidationTick()

  const [events, setEvents] = useState<CalendarEvent[]>([])
  const [errors, setErrors] = useState<Array<{ feedName: string; message: string }>>([])
  const [isLoading, setIsLoading] = useState(false)
  const [isRevalidating, setIsRevalidating] = useState(false)

  useEffect(() => {
    if (!enabled || activeFeeds.length === 0) {
      setEvents([])
      setErrors([])
      setIsLoading(false)
      return
    }

    let cancelled = false

    async function load() {
      // 1. Cache read (instant)
      const cachedResults = await Promise.all(
        activeFeeds.map((f) => getCachedEntry(f.url, dateString)),
      )
      if (cancelled) return

      const hasAnyCache = cachedResults.some((c) => c?.events)
      if (hasAnyCache) {
        const merged = mergeCachedResults(activeFeeds, cachedResults)
        setEvents(merged.events)
        setErrors(merged.errors)
        setIsLoading(false)
      } else {
        setIsLoading(true)
      }

      // 2. Background revalidate (siempre)
      setIsRevalidating(true)
      const freshResults = await Promise.all(activeFeeds.map((f) => fetchAndCache(f, dateString)))
      if (cancelled) return

      const merged = mergeFreshResults(freshResults)
      setEvents(merged.events)
      setErrors(merged.errors)
      setIsLoading(false)
      setIsRevalidating(false)

      // 3. Prefetch ±3 días (fire-and-forget)
      void prefetchSurrounding(activeFeeds, dateString)
    }

    load()
    return () => {
      cancelled = true
    }
  }, [dateString, enabled, feedKey, focusTick])

  return { events, errors, isLoading, isRevalidating }
}
```

**Helpers (mismo archivo):**

```ts
async function fetchAndCache(feed: CalendarFeed, dateString: string) {
  try {
    const rawEvents = await fetchIcsEvents(feed.url, dateString)
    const events = rawEvents.map((e) => ({ ...e, calendar: feed.name, color: feed.color }))
    await setCachedEntry(feed.url, dateString, { events, fetchedAt: Date.now() })
    return { feed, events, error: undefined }
  } catch (e) {
    const message = (e as Error).message || "Failed to fetch calendar"
    await setCachedEntry(feed.url, dateString, {
      events: [],
      fetchedAt: Date.now(),
      error: message,
    })
    return { feed, events: [], error: message }
  }
}

async function fetchAndCacheIfStale(feed: CalendarFeed, dateString: string) {
  const cached = await getCachedEntry(feed.url, dateString)
  if (cached && Date.now() - cached.fetchedAt < PREFETCH_FRESH_MS) return
  return fetchAndCache(feed, dateString)
}

async function prefetchSurrounding(feeds: CalendarFeed[], centerDate: string) {
  const dates = surroundingDates(centerDate, PREFETCH_RADIUS_DAYS) // 7 días total
  // Día por día (no todos en paralelo) para no saturar el feed con 21 requests
  for (const date of dates) {
    await Promise.all(feeds.map((f) => fetchAndCacheIfStale(f, date)))
  }
  const validUrls = new Set(feeds.map((f) => f.url))
  await evictOutsideRange(validUrls, dates[0], dates[dates.length - 1])
}

function surroundingDates(centerDate: string, radius: number): string[] {
  const result: string[] = []
  const [y, m, d] = centerDate.split("-").map(Number)
  for (let offset = -radius; offset <= radius; offset++) {
    const dt = new Date(y, m - 1, d + offset) // local time, respeta DST
    const yyyy = dt.getFullYear()
    const mm = String(dt.getMonth() + 1).padStart(2, "0")
    const dd = String(dt.getDate()).padStart(2, "0")
    result.push(`${yyyy}-${mm}-${dd}`)
  }
  return result
}

function mergeCachedResults(feeds: CalendarFeed[], cached: Array<CachedEntry | undefined>) {
  const events: CalendarEvent[] = []
  const errors: Array<{ feedName: string; message: string }> = []
  feeds.forEach((feed, i) => {
    const entry = cached[i]
    if (!entry) return
    // Re-tag con metadata fresca (user pudo renombrar/recolorear feed)
    const tagged = entry.events.map((e) => ({
      ...e,
      calendar: feed.name,
      color: feed.color,
    }))
    events.push(...tagged)
    if (entry.error) errors.push({ feedName: feed.name, message: entry.error })
  })
  return { events: sortEvents(events), errors }
}

function mergeFreshResults(
  results: Array<{ feed: CalendarFeed; events: CalendarEvent[]; error: string | undefined }>,
) {
  const events: CalendarEvent[] = []
  const errors: Array<{ feedName: string; message: string }> = []
  for (const r of results) {
    events.push(...r.events)
    if (r.error) errors.push({ feedName: r.feed.name, message: r.error })
  }
  return { events: sortEvents(events), errors }
}

function sortEvents(events: CalendarEvent[]): CalendarEvent[] {
  return [...events].sort((a, b) => {
    if (a.isAllDay && !b.isAllDay) return -1
    if (!a.isAllDay && b.isAllDay) return 1
    return a.start.localeCompare(b.start)
  })
}
```

**Focus invalidation:**

```ts
// Atom global compartido — todos los hooks de calendar comparten el mismo tick
const focusTickAtom = atom(0)

function useFocusInvalidationTick(): number {
  const tick = useAtomValue(focusTickAtom)
  const setTick = useSetAtom(focusTickAtom)
  useEffect(() => {
    const onFocus = () => setTick((t) => t + 1)
    window.addEventListener("focus", onFocus)
    return () => window.removeEventListener("focus", onFocus)
  }, [setTick])
  return tick
}
```

**Triggers de revalidate:**

- Cambio de `dateString` → useEffect re-ejecuta
- Cambio de `feedKey` (agregar/quitar/renombrar feed) → useEffect re-ejecuta
- Window focus → `focusTick` incrementa → useEffect re-ejecuta
- En todos los casos: cache hit instant + revalidate en background

---

## Module: `src/components/calendar-events.tsx` (REFACTOR)

```tsx
import { motion, AnimatePresence } from "motion/react"
import { useCalendarEvents } from "../hooks/use-calendar-events"
// ... otros imports existentes (notes, navigate, send, etc.)

export function CalendarEvents({ dateString }: { dateString: string }) {
  const { events, errors, isLoading } = useCalendarEvents(dateString)
  const enabled = useAtomValue(calendarIntegrationAtom)
  const feeds = useAtomValue(calendarFeedsAtom)
  const activeFeeds = feeds.filter((f) => f.enabled && f.url)
  const notes = useAtomValue(notesAtom)
  const send = useSetAtom(globalStateMachineAtom)
  const navigate = useNavigate()

  // openEventNote: igual que la versión actual

  if (!enabled) return null
  if (activeFeeds.length === 0) {
    return (
      <div className="my-2 flex items-center gap-2 rounded-lg bg-bg-secondary px-3 py-2 text-sm text-text-tertiary">
        <Calendar className="size-3 opacity-60" />
        <span>No calendars configured. Add one in Settings.</span>
      </div>
    )
  }
  if (isLoading && events.length === 0) {
    return (
      <div className="my-2 flex flex-col gap-0 rounded-lg bg-bg-secondary p-1">
        {[0, 1, 2].map((i) => (
          <div key={i} className="flex items-center gap-2 px-2.5 py-1">
            <Skeleton className="h-3 w-10 shrink-0" />
            <Skeleton className={i === 1 ? "h-3 w-40" : i === 0 ? "h-3 w-56" : "h-3 w-32"} />
          </div>
        ))}
      </div>
    )
  }
  if (events.length === 0 && errors.length === 0) return null

  return (
    <motion.div layout className="my-2 flex flex-col gap-0 rounded-lg bg-bg-secondary p-1">
      <AnimatePresence mode="popLayout" initial={false}>
        {events.map((event) => {
          const noteId = getEventNoteId(event)
          const hasNote = notes.has(noteId)
          return (
            <motion.button
              key={noteId}
              layout
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.12, ease: "easeOut" }}
              type="button"
              onClick={() => openEventNote(event)}
              className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1 text-left transition-colors hover:bg-bg-tertiary active:bg-bg-tertiary focus-visible:bg-bg-tertiary focus:outline-none"
              title={
                event.calendar
                  ? `${event.calendar} — ${hasNote ? "open linked note" : "create linked note"}`
                  : undefined
              }
            >
              <span
                className="shrink-0 text-sm font-medium tabular-nums"
                style={{ color: event.color }}
              >
                {formatStartTime(event)}
              </span>
              <span className="flex-1 truncate text-sm text-text">{event.title}</span>
              {hasNote ? (
                <FileText
                  className="size-3 shrink-0 text-text-tertiary"
                  aria-label="Has linked note"
                />
              ) : null}
            </motion.button>
          )
        })}
      </AnimatePresence>
      {errors.length > 0 ? (
        <div className="mt-1 flex flex-col gap-0.5 px-2 text-[10px] text-text-tertiary">
          {errors.map((e, i) => (
            <span key={i}>
              ⚠ {e.feedName}: {e.message}
            </span>
          ))}
        </div>
      ) : null}
    </motion.div>
  )
}
```

**Decisiones clave:**

- `initial={false}` evita el fade-in al primer render con cache caliente. Solo anima cambios subsiguientes.
- `mode="popLayout"` permite que items que salen no empujen a los demás durante la salida.
- `key={noteId}` (estable, sin index) permite a motion trackear "este evento es el mismo, solo cambió de posición" → anima reorders.
- `isRevalidating` no se expone en UI — el revalidate es invisible. Si llegan cambios reales, se ven por la animación.
- `transition-colors` reemplaza `transition` global para no pelear con `layout` de motion en el hover.

---

## Cleanup (REMOVE)

| Archivo                              | Cambio                                                                                                                                                                                |
| ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/utils/calendar.ts`              | Eliminar `cache` Map, `SUCCESS_TTL`, `ERROR_TTL`, `invalidateCalendarCache`. Mantener `fetchFeedEvents`/`fetchAllFeedsEvents` solo si hay otros consumers (verificar con grep antes). |
| `src/global-state.ts`                | Eliminar `calendarRefreshTickAtom` (reemplazado por `focusTickAtom` interno del hook).                                                                                                |
| `src/components/calendar-events.tsx` | Eliminar lógica de fetch local (useEffect + useState para events/errors/loading). Eliminar focus listener (lo maneja el hook).                                                        |

**Acción de verificación:** antes de eliminar `fetchFeedEvents`/`fetchAllFeedsEvents`/`calendarRefreshTickAtom`, hacer `grep -r` para confirmar que no hay otros consumers. Si los hay, conservar y solo eliminar el cache in-memory.

---

## Edge cases

| Caso                                       | Comportamiento                                                                                                                                                      |
| ------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Cold start, sin cache**                  | Skeleton durante el primer fetch, después renderiza con `initial={false}`                                                                                           |
| **IndexedDB no disponible** (modo private) | `idb-keyval` falla silenciosamente → cae al path "sin cache" en cada day open. Funciona, solo más lento.                                                            |
| **Feed roto**                              | Error queda cacheado por 5min vía `fetchAndCacheIfStale`, se muestra inline igual que hoy                                                                           |
| **Cambio de día rápido**                   | `cancelled` flag impide setState de fetches obsoletos. `AnimatePresence` cancela animaciones en curso correctamente.                                                |
| **Window focus repetido**                  | IndexedDB read es instant. Para el día actual SIEMPRE revalida (SWR). Sin debounce inicial — agregar si se vuelve problema.                                         |
| **Feed agregado/eliminado/renombrado**     | `feedKey` cambia → useEffect re-ejecuta. `evictOutsideRange` borra entries de feeds removidos. Renombrar/recolorear no invalida — los tags se reaplican al merge.   |
| **Cache version bump**                     | Subir `CACHE_VERSION` = entries viejas se ignoran y se eliminan en el primer evict.                                                                                 |
| **Daily note muy viejo** (ej. -6 meses)    | Cache miss + fetch normal. Después se prefetchean ±3 días alrededor de ese día. La ventana original (alrededor de hoy) se invalida cuando vuelvas a hoy.            |
| **Eventos recurrentes**                    | Sin cambios — `parseIcsForDate` los maneja. Cache guarda los eventos del día específico, no la regla.                                                               |
| **DST / timezone shifts**                  | `surroundingDates` usa `new Date(y, m-1, d + offset)` que respeta local time + DST. Las keys de cache son date strings locales, consistentes con cómo se llama hoy. |

---

## Testing

**Unit (vitest)** — `src/utils/calendar-cache.test.ts`:

- `setCachedEntry` + `getCachedEntry` round-trip
- `evictOutsideRange` borra entries de feeds inválidos
- `evictOutsideRange` borra entries fuera del rango de fechas
- `evictOutsideRange` borra entries de versiones viejas
- Keys con `CACHE_VERSION` distinto se ignoran al leer

**Sin tests automatizados** para `useCalendarEvents` y `<CalendarEvents>` — el SWR pattern es difícil de testear sin mockear IndexedDB + fetch + tiempo. Verificación manual cubre los casos.

**Verificación manual** (con `npm run electron:dev`):

1. **Cold start sin cache**: borrar IndexedDB en DevTools → abrir daily de hoy → ver skeleton → eventos aparecen sin fade extra (cold start = `initial={false}` no aplica)
2. **Warm navigation**: navegar hoy → mañana → ayer rápido → cada uno aparece **instant** (cache del prefetch)
3. **Window focus revalidate**: alt-tab fuera y volver → eventos visibles no parpadean → si hay cambios reales, se animan
4. **Día random fuera de ventana**: ir a `/notes/2026-08-15` → cold fetch → después se prefetchean ±3 días → volver a `/notes/2026-08-16` es instant
5. **Feed roto**: setear URL inválida → ver error inline → no spam de retries (cache de error vive 5min)
6. **Eventos cambiando**: agendar evento nuevo en Calendar.app → focus Lumen → evento aparece con fade-in 120ms
7. **Eviction**: navegar 30 días distintos → revisar IndexedDB en DevTools → solo deberían quedar ~21 keys (7 días × 3 feeds)
8. **Reload de la app**: recargar Lumen → daily de hoy aparece **instant** con cache de IndexedDB

**Build-time:**

- `npm run lint` ✅
- `npm run build` ✅
- `npm run test` ✅ (incluye los nuevos tests)

---

## Files

| Archivo                              | Tipo                                                                              |
| ------------------------------------ | --------------------------------------------------------------------------------- |
| `src/utils/calendar-cache.ts`        | NEW — IndexedDB store, get/set/evict                                              |
| `src/utils/calendar-cache.test.ts`   | NEW — unit tests                                                                  |
| `src/hooks/use-calendar-events.ts`   | NEW — hook SWR + prefetch                                                         |
| `src/components/calendar-events.tsx` | REFACTOR — usar hook, agregar motion + AnimatePresence                            |
| `src/utils/calendar.ts`              | EDIT — eliminar cache in-memory + `invalidateCalendarCache` (verificar consumers) |
| `src/global-state.ts`                | EDIT — eliminar `calendarRefreshTickAtom` (verificar consumers)                   |
| `package.json`                       | EDIT — bump 0.6.0 → 0.7.0                                                         |
| `CONTEXT.md`                         | EDIT — entry v0.7.0                                                               |

`idb-keyval` y `motion` ya están en dependencies — no se agregan deps nuevas.

---

## Versioning

`feat:` claro (cambio visible en performance + animaciones) → **MINOR bump**: `0.6.0` → `0.7.0`.

Bump en último commit del feature branch antes de abrir el PR. El workflow `electron-release.yml` crea el tag + GitHub Release automáticamente sobre el squash commit.

**Dependencia:** este PR debe abrirse contra un `personal` que ya tenga PR#6 (breadcrumbs v0.6.0) mergeado. Si PR#6 sigue abierto al momento de abrir este, hacer rebase sobre el `personal` actualizado primero.

---

## Implementation order

1. `src/utils/calendar-cache.ts` + tests
2. `src/hooks/use-calendar-events.ts`
3. Refactor `src/components/calendar-events.tsx`
4. Cleanup en `src/utils/calendar.ts` + `src/global-state.ts` (con grep de consumers)
5. Manual verification end-to-end con `electron:dev`
6. Bump version + CONTEXT.md
7. Code review (`superpowers:code-reviewer`)
8. PR
