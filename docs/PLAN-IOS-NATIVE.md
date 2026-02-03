# Plan: Migración de Lumen Web a iOS Nativo

> **Fecha de creación:** 2026-02-02
> **Estado:** Pendiente de implementación
> **Duración estimada:** ~17 semanas

## Resumen Ejecutivo

**Objetivo:** Crear una app iOS nativa de Lumen que conviva con la versión web, compartiendo el mismo repositorio GitHub como fuente de verdad.

**Decisiones clave confirmadas:**

- ✅ Git nativo en iOS (SwiftGit2/libgit2)
- ✅ Editor: Runestone (similar a CodeMirror)
- ✅ Voice Assistant: P2 (no en MVP)
- ✅ Code sharing: Evaluar ambas opciones en el plan

---

## 1. Resumen del Producto Actual

### Qué hace

- App de notas markdown con wikilinks `[[nota]]`, tags `#tag`, templates
- Sincronización bidireccional con GitHub (el repo del usuario ES la base de datos)
- Offline-first: funciona sin internet, sincroniza al reconectar
- Editor rico (CodeMirror 6) con syntax highlighting custom
- Tasks integrados con prioridad y fechas
- Búsqueda fuzzy sobre todas las notas

### Arquitectura Web Relevante

| Capa    | Tecnología                    | Función                                              |
| ------- | ----------------------------- | ---------------------------------------------------- |
| State   | XState + Jotai                | Máquina de estados + atoms reactivos                 |
| Git     | isomorphic-git + lightning-fs | Git completo en navegador                            |
| Editor  | CodeMirror 6                  | Editor markdown con 8 extensiones custom             |
| Parsing | Remark/Unified                | 4 plugins custom (wikilinks, tags, priority, embeds) |
| API     | Vercel Functions              | Solo 2 críticos: OAuth callback + CORS proxy         |

### Flujos Core

1. **Auth**: OAuth GitHub → token → localStorage
2. **Clone**: `git clone` shallow → parse markdown → `notesAtom`
3. **Edit**: CodeMirror → draft → `WRITE_FILES` → git commit → auto-push
4. **Search**: fast-fuzzy client-side sobre `notesAtom`

### Riesgos Identificados

- No hay equivalente Swift directo de isomorphic-git (usar SwiftGit2/libgit2)
- 4 plugins remark custom necesitan reimplementación en Swift
- 8 extensiones CodeMirror no portables (Runestone tiene API diferente)
- Editor requiere autocomplete de wikilinks/tags

---

## 2. Estrategias de Migración

### Opción A: iOS 100% Swift (Recomendada para MVP)

```
┌─────────────────────────────────────────┐
│         Web (React/TypeScript)          │
│  - Estado actual, sigue evolucionando   │
└─────────────────────────────────────────┘
                    ↕ Mismo repo GitHub
┌─────────────────────────────────────────┐
│         iOS (Swift/SwiftUI)             │
│  - Lógica reimplementada en Swift       │
│  - Contract tests garantizan paridad    │
└─────────────────────────────────────────┘
```

**Pros:**

- Stack 100% nativo, debugging familiar
- Sin overhead de bridging
- Acceso completo a APIs de iOS (Widgets, Spotlight, iCloud backup)
- Build más rápido, sin Gradle

**Cons:**

- ~2000 LOC de parsing/search duplicados
- Bug fixes deben aplicarse en ambas plataformas
- Riesgo de drift si no hay contract tests rigurosos

**Mitiga riesgos con:**

- JSON fixtures compartidos (contract tests)
- Especificación formal de comportamiento
- CI que valida paridad

---

### Opción B: Kotlin Multiplatform (KMP) para Domain Layer

```
┌─────────────────────────────────────────┐
│         Web (React/TypeScript)          │
└─────────────────────────────────────────┘
                    ↕
┌─────────────────────────────────────────┐
│      Shared Domain (Kotlin)             │
│  - NoteParser, QueryParser, DateUtils   │
│  - Models (Note, Task, Template)        │
└─────────────────────────────────────────┘
           ↙                    ↘
┌─────────────────┐    ┌─────────────────┐
│ iOS (Swift/UI)  │    │ Android (futu.) │
│ - Presentation  │    │ - Presentation  │
│ - Git (Swift)   │    │ - Git (JGit)    │
└─────────────────┘    └─────────────────┘
```

**Pros:**

- Lógica de dominio escrita una vez
- Paridad garantizada (mismo código)
- Android casi gratis si se necesita después
- Un solo test suite para domain

**Cons:**

- Curva de aprendizaje Kotlin + KMP
- Complejidad de build (Gradle + SPM)
- Debugging cross-language más difícil
- +5-10MB en binary size

---

### Recomendación: Empezar con Opción A

**Razón:** La lógica de Lumen es estable (parsing, wikilinks, tags). El riesgo de drift es manejable con contract tests. Si Android se vuelve prioridad, migrar `LumenDomain` a KMP es factible después.

---

## 3. Arquitectura iOS Target

### 3.1 Diagrama de Capas

```
┌─────────────────────────────────────────────────────────────────┐
│                        App Layer                                 │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │                    LumenApp (SwiftUI)                       │ │
│  │  AppCoordinator → NavigationStack + sheets                  │ │
│  └────────────────────────────────────────────────────────────┘ │
├─────────────────────────────────────────────────────────────────┤
│                    Presentation Layer                            │
│  NoteListView │ NoteEditView │ SearchView │ SettingsView        │
│       ↓              ↓             ↓            ↓               │
│  NoteListStore  NoteEditStore  SearchStore  SettingsStore       │
│  (TCA Reducer)  (TCA Reducer)  (TCA Reducer) (TCA Reducer)      │
├─────────────────────────────────────────────────────────────────┤
│                      Domain Layer                                │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │                    AppState (Global)                         ││
│  │  AuthState │ RepoState │ SyncState │ NotesState             ││
│  └─────────────────────────────────────────────────────────────┘│
│  ┌─────────────────────────────────────────────────────────────┐│
│  │                   Use Cases                                  ││
│  │  ParseNoteUC │ SearchNotesUC │ SyncRepoUC │ SaveNoteUC      ││
│  └─────────────────────────────────────────────────────────────┘│
├─────────────────────────────────────────────────────────────────┤
│                       Data Layer                                 │
│  GitRepository (Protocol) → SwiftGit2Impl                       │
│  NoteRepository (Protocol) → FileSystemImpl                     │
│  SettingsRepository (Protocol) → UserDefaultsImpl               │
├─────────────────────────────────────────────────────────────────┤
│                    Infrastructure Layer                          │
│  GitHubAPIClient │ KeychainService │ FileManager                │
└─────────────────────────────────────────────────────────────────┘
```

### 3.2 Módulos Swift Package Manager

```
LumenApp/
├── Packages/
│   ├── LumenDomain/          # Pure Swift, no iOS deps
│   │   ├── Models/           # Note, Task, Template, GitHubUser
│   │   ├── Parsing/          # NoteParser, WikilinkParser, TagParser
│   │   ├── Search/           # QueryParser, FuzzySearcher, Filter
│   │   └── Protocols/        # GitRepository, NoteRepository
│   │
│   ├── LumenData/            # Data layer implementations
│   │   ├── Git/              # SwiftGit2 wrapper
│   │   ├── Storage/          # FileSystem, UserDefaults
│   │   ├── Network/          # GitHubAPI, OAuth
│   │   └── Keychain/         # Secure token storage
│   │
│   ├── LumenUI/              # Componentes SwiftUI reutilizables
│   │   ├── Components/       # NoteListRow, TagChip, TaskCheckbox
│   │   ├── Editor/           # RunestoneWrapper
│   │   └── Theme/            # Colors, fonts
│   │
│   └── LumenApp/             # Main app target
│       ├── Features/         # NoteList, NoteDetail, Search, Settings
│       └── State/            # AppState, AppReducer (TCA)
```

### 3.3 State Management: TCA (The Composable Architecture)

**Equivalencia con XState:**

| Web (XState) | iOS (TCA)                   |
| ------------ | --------------------------- |
| `context`    | `State` struct              |
| `events`     | `Action` enum               |
| `services`   | `Effect`                    |
| `guards`     | Condiciones en `Reduce`     |
| `states`     | Pattern matching en `State` |

```swift
@Reducer
struct AppFeature {
    @ObservableState
    struct State: Equatable {
        var authState: AuthState = .signedOut
        var repoState: RepoState = .notCloned
        var syncState: SyncState = .idle
        var notes: IdentifiedArrayOf<Note> = []
        var searchQuery: String = ""
    }

    enum Action {
        case signIn(GitHubUser)
        case signOut
        case selectRepo(GitHubRepository)
        case sync
        case writeFiles([String: String?])
        // ...
    }

    var body: some ReducerOf<Self> {
        // State machine transitions
    }
}
```

### 3.4 Navegación: NavigationStack + Coordinator

```swift
@Observable
final class AppCoordinator {
    var path = NavigationPath()
    var presentedSheet: SheetDestination?

    enum Destination: Hashable {
        case noteDetail(NoteId)
        case tag(String)
        case search(String?)
    }

    func navigateToNote(_ id: NoteId) {
        path.append(Destination.noteDetail(id))
    }
}
```

### 3.5 Componentes Críticos

| Componente       | Web                     | iOS Recomendado                 |
| ---------------- | ----------------------- | ------------------------------- |
| Markdown parsing | remark + custom plugins | swift-markdown + parsers custom |
| Git operations   | isomorphic-git          | SwiftGit2 (libgit2)             |
| Editor           | CodeMirror 6            | Runestone                       |
| Fuzzy search     | fast-fuzzy              | Fuse-Swift                      |
| State machine    | XState                  | TCA Reducer                     |
| OAuth            | Vercel Function         | ASWebAuthenticationSession      |

---

## 4. Mapa de Equivalencias

### 4.1 Features Web → Pantallas iOS

| Feature Web    | Ruta Web     | Pantalla iOS              | Prioridad |
| -------------- | ------------ | ------------------------- | --------- |
| Lista de notas | `/`          | `NoteListView`            | P0        |
| Detalle/editor | `/notes/:id` | `NoteDetailView`          | P0        |
| Búsqueda       | `?query=...` | `SearchView`              | P0        |
| Tags           | `/tags/:tag` | `TagNotesView`            | P0        |
| Calendario     | `/calendar`  | `CalendarView`            | P1        |
| Tasks          | `/tasks`     | `TasksView`               | P1        |
| Settings       | `/settings`  | `SettingsView`            | P0        |
| Sign in        | Modal        | `SignInView` (fullScreen) | P0        |
| Quick Note     | Hotkey ⌥⇧N   | Widget + Share Extension  | P2        |

### 4.2 Componentes Web → Componentes iOS

| Componente Web              | Componente iOS                   |
| --------------------------- | -------------------------------- |
| `<NoteList>`                | `NoteListView` (SwiftUI List)    |
| `<NoteEditor>` (CodeMirror) | `MarkdownEditorView` (Runestone) |
| `<TaskList>`                | `TaskListView`                   |
| `<TaskItem>`                | `TaskRowView`                    |
| `<CommandMenu>` (⌘K)        | `.searchable()` + Spotlight      |
| `<Sidebar>`                 | `NavigationSplitView` sidebar    |
| `<Calendar>`                | Custom `CalendarView`            |
| `<Dropdown>`                | SwiftUI `Menu`                   |
| `<Dialog>`                  | `.sheet()` / `.alert()`          |

### 4.3 Estado Web → State Management iOS

| Atom/State Web           | State iOS (TCA)                        |
| ------------------------ | -------------------------------------- |
| `globalStateMachineAtom` | `AppFeature.State`                     |
| `notesAtom`              | `state.notes: IdentifiedArrayOf<Note>` |
| `tagsAtom`               | `state.tags: [String: [NoteId]]`       |
| `backlinksIndexAtom`     | `state.backlinks: [NoteId: [NoteId]]`  |
| `githubUserAtom`         | `state.authState.user`                 |
| `themeAtom`              | `@AppStorage("theme")`                 |
| `sidebarAtom`            | `state.sidebarCollapsed`               |

### 4.4 Navegación Web → Navegación iOS

| Navegación Web         | Navegación iOS              |
| ---------------------- | --------------------------- |
| TanStack Router path   | `NavigationPath`            |
| Search params `?mode=` | View state en Store         |
| `navigate()`           | `coordinator.path.append()` |
| `Link` component       | `NavigationLink`            |
| Modal dialog           | `.sheet()`                  |
| Full screen modal      | `.fullScreenCover()`        |

---

## 5. Plan por Fases

### Fase 0: Auditoría y Setup (2 semanas)

**Objetivo:** Preparar el terreno técnico y documentar contratos.

| Entregable      | Descripción                                        | Done when           |
| --------------- | -------------------------------------------------- | ------------------- |
| Spec de parsing | Documento formal de reglas (wikilinks, tags, etc.) | Revisado y aprobado |
| JSON fixtures   | Test fixtures compartidos web/iOS                  | 50+ casos de prueba |
| Xcode project   | Proyecto con estructura SPM                        | Compila sin errores |
| CI básico       | GitHub Actions para iOS build + test               | Green en PR         |
| SwiftGit2 PoC   | Proof of concept de clone/pull/push                | Demo funcional      |

**Riesgos:**

- SwiftGit2 puede tener limitaciones no documentadas
- libgit2 compilation en CI puede ser lento

**Validación paridad:** N/A (setup)

---

### Fase 1: Foundations iOS (3 semanas)

**Objetivo:** Auth funcional + Git operations + Modelos core.

| Entregable            | Descripción                     | Done when               |
| --------------------- | ------------------------------- | ----------------------- |
| `LumenDomain` package | Note, Task, Template models     | Tests pasan             |
| `NoteParser`          | Parser que pasa contract tests  | 100% fixtures verdes    |
| `GitRepository`       | Clone, pull, push, commit       | E2E con repo real       |
| `GitHubOAuth`         | ASWebAuthenticationSession flow | Login funciona          |
| `KeychainService`     | Secure token storage            | Persiste entre launches |

**Riesgos:**

- OAuth redirect URI setup en GitHub App
- Conflictos de merge en Git (sin UI aún)

**Validación paridad:**

- Contract tests de parsing: ✅ debe pasar 100%
- Manual: Clonar mismo repo que web, verificar que lee mismas notas

---

### Fase 2: UI Shell (3 semanas)

**Objetivo:** Navegación básica y lista de notas funcional.

| Entregable       | Descripción             | Done when                 |
| ---------------- | ----------------------- | ------------------------- |
| `AppCoordinator` | Navegación completa     | Todas las rutas funcionan |
| `NoteListView`   | Lista con search básico | Muestra notas del repo    |
| `NoteDetailView` | Vista read-only de nota | Renderiza markdown        |
| `SettingsView`   | Sign out, theme básico  | Funciona                  |
| `SignInView`     | Full screen OAuth flow  | Completo                  |

**Riesgos:**

- Performance con muchas notas (>500)
- Rendering de markdown complejo

**Validación paridad:**

- Mismas notas visibles que en web
- Orden de notas idéntico (sort by updated_at + pinned)

---

### Fase 3: Editor (4 semanas)

**Objetivo:** Editor funcional con save/sync.

| Entregable            | Descripción               | Done when            |
| --------------------- | ------------------------- | -------------------- |
| Runestone integration | Editor markdown básico    | Edición funciona     |
| Syntax highlighting   | Wikilinks, tags, headings | Visualmente correcto |
| Autocomplete          | Wikilinks `[[` y tags `#` | Popup funciona       |
| Save flow             | Write → git add → commit  | Nota persiste        |
| Auto-sync             | Push después de save      | Cambios en GitHub    |

**Riesgos:**

- Runestone API diferente a CodeMirror
- Performance de autocomplete con muchas notas
- Conflictos de sync (concurrent edits web/iOS)

**Validación paridad:**

- Editar nota en iOS, ver cambio en web (después de sync)
- Formato de archivo idéntico (frontmatter, line endings)

---

### Fase 4: Features Secundarias (3 semanas)

**Objetivo:** Paridad funcional con features P1.

| Entregable      | Descripción                    | Done when                            |
| --------------- | ------------------------------ | ------------------------------------ |
| `TagsView`      | Lista de tags + notas          | Funciona                             |
| `CalendarView`  | Vista mensual/semanal          | Muestra daily notes                  |
| `TasksView`     | Lista de tasks filtrable       | Funciona                             |
| Advanced search | Qualifiers (tag:, date:, etc.) | Paridad con web                      |
| Offline mode    | Funciona sin internet          | Cambios se sincronizan al reconectar |

**Riesgos:**

- Complejidad de query parsing
- Edge cases de sync offline

**Validación paridad:**

- Mismos resultados de búsqueda que web
- Tasks ordenados igual

---

### Fase 5: Polish y Release (2 semanas)

**Objetivo:** App lista para App Store.

| Entregable       | Descripción               | Done when              |
| ---------------- | ------------------------- | ---------------------- |
| Error handling   | UI para todos los errores | No crashes             |
| Loading states   | Skeletons, spinners       | UX pulida              |
| App Store assets | Screenshots, descripción  | Listos                 |
| TestFlight       | Beta testing              | 1 semana de feedback   |
| Performance      | Profiling y optimización  | <100ms cold start list |

**Validación paridad:**

- Checklist completo de features web vs iOS
- User testing comparativo

---

## 6. Estrategia de Pruebas

### 6.1 Unit Tests (Domain)

```swift
// LumenDomainTests/
├── NoteParserTests.swift      // Contract tests (JSON fixtures)
├── WikilinkParserTests.swift  // Syntax edge cases
├── TagParserTests.swift
├── FrontmatterParserTests.swift
├── QueryParserTests.swift     // Search query parsing
├── NoteSorterTests.swift
└── DateUtilsTests.swift
```

**Objetivo:** 100% de fixtures JSON compartidos pasan.

### 6.2 Integration Tests (Data)

```swift
// LumenDataTests/
├── SwiftGit2RepositoryTests.swift  // Clone, pull, push con repo de test
├── GitHubAPIClientTests.swift      // Mock responses
└── FileSystemRepositoryTests.swift // Read/write files
```

**Objetivo:** Git operations funcionan contra repo real de test.

### 6.3 Contract Tests

**Shared fixtures en `/lumen-test-fixtures/`:**

```json
// parsing/wikilinks.json
{
  "tests": [
    { "input": "[[123]]", "expected": { "id": "123", "text": "" } },
    { "input": "[[note|Label]]", "expected": { "id": "note", "text": "Label" } },
    { "input": "[[]]", "expected": null }
  ]
}
```

**CI valida:**

- Web: `npm test` pasa todos los fixtures
- iOS: `xcodebuild test` pasa todos los fixtures
- Diff: Script compara resultados

### 6.4 UI Tests / Snapshots

```swift
// LumenUITests/
├── NoteListSnapshotTests.swift
├── NoteDetailSnapshotTests.swift
└── EditorSnapshotTests.swift
```

**Tool:** swift-snapshot-testing de PointFree.

### 6.5 E2E Tests

Manual checklist para cada release:

- [ ] Sign in con GitHub
- [ ] Clone repo
- [ ] Ver lista de notas
- [ ] Abrir nota
- [ ] Editar nota
- [ ] Guardar y ver cambio en web
- [ ] Crear nueva nota
- [ ] Borrar nota
- [ ] Buscar nota
- [ ] Filtrar por tag
- [ ] Sign out

---

## 7. Backlog Inicial

### Epic: [E1] Foundations

| ID    | Tipo  | Título                                       | Size | Priority | Parity |
| ----- | ----- | -------------------------------------------- | ---- | -------- | ------ |
| E1-S1 | Story | Como usuario, quiero autenticarme con GitHub | L    | P0       | ✅     |
| E1-T1 | Task  | Setup ASWebAuthenticationSession             | M    | P0       |        |
| E1-T2 | Task  | Implementar KeychainService                  | S    | P0       |        |
| E1-T3 | Task  | Crear GitHubAPIClient                        | M    | P0       |        |
| E1-S2 | Story | Como usuario, quiero clonar mi repositorio   | L    | P0       | ✅     |
| E1-T4 | Task  | Integrar SwiftGit2                           | L    | P0       |        |
| E1-T5 | Task  | Implementar clone con progress               | M    | P0       |        |
| E1-T6 | Task  | Manejar errores de clone                     | S    | P0       |        |
| E1-S3 | Story | Como usuario, quiero sincronizar cambios     | L    | P0       | ✅     |
| E1-T7 | Task  | Implementar pull                             | M    | P0       |        |
| E1-T8 | Task  | Implementar push                             | M    | P0       |        |
| E1-T9 | Task  | Detectar conflictos (básico)                 | M    | P0       |        |

### Epic: [E2] Domain Layer

| ID    | Tipo  | Título                                  | Size | Priority | Parity |
| ----- | ----- | --------------------------------------- | ---- | -------- | ------ |
| E2-S1 | Story | Como dev, quiero parsear notas markdown | L    | P0       | ✅     |
| E2-T1 | Task  | Crear Note model                        | S    | P0       | ✅     |
| E2-T2 | Task  | Implementar FrontmatterParser           | M    | P0       | ✅     |
| E2-T3 | Task  | Implementar WikilinkParser              | M    | P0       | ✅     |
| E2-T4 | Task  | Implementar TagParser                   | M    | P0       | ✅     |
| E2-T5 | Task  | Implementar TaskParser                  | M    | P0       | ✅     |
| E2-T6 | Task  | Crear contract tests JSON               | M    | P0       | ✅     |
| E2-S2 | Story | Como usuario, quiero buscar notas       | M    | P0       | ✅     |
| E2-T7 | Task  | Implementar FuzzySearcher               | M    | P0       | ✅     |
| E2-T8 | Task  | Implementar QueryParser                 | L    | P1       | ✅     |
| E2-T9 | Task  | Implementar filtros (tag:, date:)       | M    | P1       | ✅     |

### Epic: [E3] UI Shell

| ID    | Tipo  | Título                                          | Size | Priority | Parity |
| ----- | ----- | ----------------------------------------------- | ---- | -------- | ------ |
| E3-S1 | Story | Como usuario, quiero ver mi lista de notas      | M    | P0       | ✅     |
| E3-T1 | Task  | Crear NoteListView                              | M    | P0       |        |
| E3-T2 | Task  | Implementar NoteListRow                         | S    | P0       |        |
| E3-T3 | Task  | Añadir pull-to-refresh                          | S    | P0       |        |
| E3-S2 | Story | Como usuario, quiero ver el detalle de una nota | M    | P0       | ✅     |
| E3-T4 | Task  | Crear NoteDetailView                            | M    | P0       |        |
| E3-T5 | Task  | Renderizar markdown básico                      | M    | P0       |        |
| E3-T6 | Task  | Hacer wikilinks clickables                      | M    | P0       | ✅     |
| E3-S3 | Story | Como usuario, quiero navegar entre pantallas    | M    | P0       |        |
| E3-T7 | Task  | Implementar AppCoordinator                      | M    | P0       |        |
| E3-T8 | Task  | Setup NavigationStack                           | S    | P0       |        |

### Epic: [E4] Editor

| ID    | Tipo  | Título                               | Size | Priority | Parity |
| ----- | ----- | ------------------------------------ | ---- | -------- | ------ |
| E4-S1 | Story | Como usuario, quiero editar notas    | XL   | P0       | ✅     |
| E4-T1 | Task  | Integrar Runestone                   | L    | P0       |        |
| E4-T2 | Task  | Configurar syntax highlighting       | M    | P0       |        |
| E4-T3 | Task  | Implementar wikilink highlighter     | M    | P0       | ✅     |
| E4-T4 | Task  | Implementar tag highlighter          | S    | P0       | ✅     |
| E4-S2 | Story | Como usuario, quiero autocomplete    | L    | P0       | ✅     |
| E4-T5 | Task  | Autocomplete de wikilinks `[[`       | L    | P0       | ✅     |
| E4-T6 | Task  | Autocomplete de tags `#`             | M    | P0       | ✅     |
| E4-S3 | Story | Como usuario, quiero guardar cambios | M    | P0       | ✅     |
| E4-T7 | Task  | Implementar save flow                | M    | P0       |        |
| E4-T8 | Task  | Auto-save con debounce               | M    | P1       | ✅     |
| E4-T9 | Task  | Manejar drafts locales               | M    | P1       | ✅     |

### Epic: [E5] Features Secundarias

| ID    | Tipo  | Título                                  | Size | Priority | Parity |
| ----- | ----- | --------------------------------------- | ---- | -------- | ------ |
| E5-S1 | Story | Como usuario, quiero ver notas por tag  | M    | P1       | ✅     |
| E5-T1 | Task  | Crear TagsView                          | M    | P1       |        |
| E5-T2 | Task  | Crear TagNotesView                      | S    | P1       |        |
| E5-S2 | Story | Como usuario, quiero ver calendario     | L    | P1       | ✅     |
| E5-T3 | Task  | Crear CalendarView                      | L    | P1       |        |
| E5-T4 | Task  | Navegación a daily notes                | M    | P1       | ✅     |
| E5-S3 | Story | Como usuario, quiero gestionar tasks    | L    | P1       | ✅     |
| E5-T5 | Task  | Crear TasksView                         | L    | P1       |        |
| E5-T6 | Task  | Toggle task completion                  | M    | P1       | ✅     |
| E5-T7 | Task  | Filtros por prioridad                   | S    | P1       | ✅     |
| E5-S4 | Story | Como usuario, quiero crear nuevas notas | M    | P0       | ✅     |
| E5-T8 | Task  | Crear NewNoteView                       | M    | P0       |        |
| E5-T9 | Task  | Generar NoteId único                    | S    | P0       | ✅     |

### Epic: [E6] Polish

| ID    | Tipo  | Título                                 | Size | Priority | Parity |
| ----- | ----- | -------------------------------------- | ---- | -------- | ------ |
| E6-S1 | Story | Como usuario, quiero feedback visual   | M    | P1       |        |
| E6-T1 | Task  | Loading states (skeletons)             | M    | P1       |        |
| E6-T2 | Task  | Error states UI                        | M    | P1       |        |
| E6-T3 | Task  | Empty states                           | S    | P1       |        |
| E6-S2 | Story | Como usuario, quiero configurar la app | M    | P1       | ✅     |
| E6-T4 | Task  | SettingsView completo                  | M    | P1       |        |
| E6-T5 | Task  | Theme switching                        | M    | P2       | ✅     |
| E6-S3 | Story | Como usuario, quiero usar offline      | L    | P1       | ✅     |
| E6-T6 | Task  | Detectar estado offline                | S    | P1       |        |
| E6-T7 | Task  | Queue de cambios pendientes            | L    | P1       | ✅     |
| E6-T8 | Task  | Sync automático al reconectar          | M    | P1       | ✅     |

---

## 8. Archivos Críticos para Implementación

Los siguientes archivos del proyecto web son la fuente de verdad para reimplementar en iOS:

| Archivo                          | Propósito                         | Prioridad |
| -------------------------------- | --------------------------------- | --------- |
| `src/utils/parse-note.ts`        | Core parsing: markdown → Note     | P0        |
| `src/global-state.ts`            | XState machine (auth, repo, sync) | P0        |
| `src/remark-plugins/wikilink.ts` | Syntax `[[id\|label]]`            | P0        |
| `src/remark-plugins/tag.ts`      | Syntax `#tag`                     | P0        |
| `src/utils/frontmatter.ts`       | YAML frontmatter handling         | P0        |
| `src/utils/search.ts`            | Query parsing y filtros           | P1        |
| `src/utils/git.ts`               | Git operations wrapper            | P0        |
| `src/schema.ts`                  | Tipos (Note, Task, etc.)          | P0        |

---

## 9. Verificación de Paridad

### Checklist Pre-Release

- [ ] **Parsing:** Todos los contract tests JSON pasan
- [ ] **Notas:** Mismas notas visibles en web e iOS
- [ ] **Orden:** Sort idéntico (updated_at + pinned)
- [ ] **Search:** Mismos resultados para misma query
- [ ] **Tags:** Mismo conteo de notas por tag
- [ ] **Tasks:** Mismo listado y orden
- [ ] **Edit:** Formato de archivo idéntico después de guardar
- [ ] **Sync:** Cambio en iOS visible en web y viceversa

### CI Pipeline

```yaml
jobs:
  parity-check:
    steps:
      - run: npm test -- --json > web-results.json
      - run: xcodebuild test -scheme LumenDomain
      - run: ./scripts/compare-parity.sh
```

---

## Para Retomar Este Plan

Cuando decidas implementar la app iOS:

1. **Revisar** este documento y validar que las decisiones siguen vigentes
2. **Comenzar** con Fase 0: Auditoría y Setup
3. **Crear** el proyecto Xcode con la estructura SPM propuesta
4. **Implementar** el PoC de SwiftGit2 para validar viabilidad
5. **Iterar** fase por fase según el roadmap
