# 🧠 FlowOS — PRD Completo (v1.0)

---

## 1. Visión

FlowOS es un sistema personal-first para gestión de trabajo que prioriza:

- captura sin fricción
- estructuración automática
- seguimiento inteligente

No busca reemplazar herramientas tradicionales, sino resolver el problema central:

> convertir pensamiento caótico en progreso estructurado sin esfuerzo manual

---

## 2. Problema

### Contexto actual

- múltiples fuentes de información (reuniones, chats, ideas)
- herramientas fragmentadas (Notion, Jira, etc.)
- alto costo de input manual

### Problemas detectados

1. La captura de información es lenta
2. El seguimiento no ocurre sistemáticamente
3. La información se pierde o queda incompleta
4. Las herramientas obligan estructura prematura

---

## 3. Objetivos

### Objetivo principal

Reducir a casi cero el costo de capturar información y automatizar el seguimiento.

### Objetivos secundarios

- centralizar visibilidad de equipo y proyectos
- permitir edición flexible y visual
- construir sobre estándares simples (Markdown + Git)

---

## 4. Principios del producto

1. Input > estructura
2. Write first, structure later
3. Local-first + Git-native
4. AI como asistente, no como reemplazo
5. Seguimiento automático por defecto

---

## 5. Arquitectura

### Visión general

```
UI (web local)
   ↓
API (FastAPI)
   ↓
Core Engine (lógica + AI)
   ↓
Markdown Files + Git
```

---

## 6. Componentes del sistema

### 6.1 Core Engine

Responsabilidades:

- parsing de input
- enriquecimiento con AI
- gestión de inbox
- creación de entidades (tasks, projects, etc.)
- nudges automáticos

Estructura:

```
/core
  parser.py
  ai.py
  inbox.py
  tasks.py
  projects.py
  people.py
  nudges.py
```

---

### 6.2 CLI

Uso principal:

- quick capture
- comandos rápidos
- automatización

Comandos:

```
flow add
flow inbox
flow inbox process
flow inbox apply
flow nudge
flow status
```

---

### 6.3 API (FastAPI)

Endpoints iniciales:

```
GET    /inbox
POST   /inbox/process
POST   /inbox/apply
GET    /tasks
POST   /tasks
GET    /projects
GET    /people
```

---

### 6.4 UI (Web App local)

Stack:

- Next.js
- Tailwind

Vistas principales:

#### Inbox

- lista de inputs crudos
- sugerencias AI
- acciones:

  - convertir
  - editar
  - ignorar

#### Projects

- lista y detalle
- tasks asociadas
- contexto

#### Tasks

- estado
- prioridad
- seguimiento

#### People

- carga de trabajo
- blockers

---

## 7. Smart Inbox

### Definición

Espacio donde todo input entra sin fricción y se estructura después.

---

### Flujo

1. Usuario captura input
2. Se guarda en `/inbox`
3. AI genera sugerencias
4. Usuario revisa
5. Se convierte en entidad

---

### Formato

```
/inbox/YYYY-MM-DD-XXX.md
```

Contenido:

```
# Raw Input
texto original

# Metadata
status: unprocessed
date: YYYY-MM-DD

# Suggestions
type: task
person: Nico
project: wallet

# Actions
[ ] convert
[ ] ignore
```

---

## 8. Quick Input

### Objetivo

Reducir fricción al mínimo.

### Tipos

- CLI texto
- voz (speech-to-text)
- input desde UI

---

## 9. AI Layer

### Funciones

- clasificar input
- detectar entidades
- sugerir estructura
- enriquecer contexto

---

### Estrategia

Modelo híbrido:

- local → tareas simples
- cloud → parsing complejo

---

## 10. Modelo de datos

### Estructura

```
/inbox/
/tasks/
/projects/
/people/
/weekly/
```

---

### Ejemplo Task

```
/tasks/wallet-security.md

title: Wallet security improvements
status: active
assignee: Nico
project: wallet
priority: high
```

---

### Ejemplo Project

```
/projects/wallet.md

owner: Nico
pm: nombre
status: active

## Tasks
- ...
```

---

## 11. Sistema de seguimiento

### Nudges automáticos

- día 3 → recordatorio
- día 5 → cierre

---

### Ejecución

```
flow nudge
```

(o cron)

---

## 12. Nutrición de contexto

El sistema puede:

- agregar info a proyectos existentes
- enriquecer tasks
- evitar duplicación

---

## 13. Flujos clave

### Weekly → seguimiento

1. input libre
2. parsing automático
3. generación de tasks
4. seguimiento

---

### Quick capture

1. input
2. inbox
3. procesamiento posterior

---

### Inbox processing

1. ver inbox
2. revisar sugerencias
3. convertir

---

## 14. MVP Scope

### Semana 1

- CLI (`flow add`)
- inbox básico
- markdown storage

### Semana 2

- parsing simple (heurísticas)

### Semana 3

- AI integration

### Semana 4

- nudges + conversión a tasks

---

## 15. Roadmap

### Fase 2

- API (FastAPI)
- endpoints básicos

### Fase 3

- UI Inbox

### Fase 4

- UI completa (projects + tasks)

---

## 16. Riesgos

1. sobre ingeniería
2. dependencia excesiva de AI
3. fricción en revisión

---

## 17. Mitigaciones

- mantener CLI-first
- iterar contigo como usuario único
- evitar features innecesarias

---

## 18. Métricas de éxito

- tiempo de captura < 5 segundos
- reducción de uso de otras tools
- visibilidad inmediata del estado del equipo
- uso diario sostenido

---

## 19. Definición de éxito (usuario)

El sistema funciona si puedes:

- capturar cualquier idea en segundos
- saber qué está pasando sin preguntar
- no depender de Notion/Jira
- sentir que el sistema empuja el trabajo

---

## 20. Siguiente paso técnico

Implementar:

1. estructura de repo
2. comando `flow add`
3. creación automática de archivos inbox

---

## 21. Insight final

El valor no está en organizar información.

Está en esto:

> capturar sin pensar
> estructurar sin esfuerzo
> avanzar sin recordar

---

FlowOS no es un gestor de tareas.

Es un sistema que convierte pensamiento en progreso.
