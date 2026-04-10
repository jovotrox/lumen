# FlowOS — Implementation Plan

## Context

FlowOS is a personal-first work management system that converts chaotic thinking into structured progress. The project is greenfield (only PRD.md exists). The core problem: capturing information is slow, follow-up doesn't happen systematically, and current tools force premature structure.

This plan uses **Vertical Slices** — each slice closes a functional loop end-to-end, validated with real use before advancing. Models, states, and features are added **only when a slice demands them**. Quality gates (tests, linting, type checking) run at every slice boundary.

### Design Decisions

| Decision       | Choice                          | Why                                                     |
| -------------- | ------------------------------- | ------------------------------------------------------- |
| AI Provider    | LiteLLM (multi-provider)        | Flexibility to switch between Ollama, OpenAI, Anthropic |
| Target User    | Solo user (MVP)                 | Simplicity; team features added post-MVP                |
| Data Location  | `/data` inside repo             | Git-tracked, portable, the repo IS the system           |
| Python Tooling | `uv` + `hatchling`              | Fast, modern, single binary                             |
| Voice Input    | Include in MVP                  | Core to frictionless capture vision                     |
| UI             | Monorepo `/ui` folder           | Post-MVP, but collocated for sync                       |
| Approach       | Vertical Slices + quality gates | Working software from day 1, validated by real use      |

---

## Slice 0: Project Scaffolding

**Goal**: Working Python project skeleton with tooling, git, and CLAUDE.md.

### Files to Create

**`pyproject.toml`**:

```toml
[project]
name = "flowos"
version = "0.1.0"
description = "Personal-first work management system"
requires-python = ">=3.11"
dependencies = [
    "typer>=0.12,<1.0",
    "rich>=13.0",
    "python-frontmatter>=1.1",
    "pydantic>=2.7,<3.0",
]

[project.optional-dependencies]
ai = ["litellm>=1.40"]
voice = ["openai>=1.0", "sounddevice>=0.4", "soundfile>=0.12"]
api = ["fastapi>=0.115", "uvicorn[standard]>=0.30"]
dev = ["pytest>=8.0", "pytest-cov>=5.0", "ruff>=0.5", "mypy>=1.10"]

[project.scripts]
flow = "flowos.cli.main:app"

[tool.ruff]
target-version = "py311"
line-length = 100

[tool.ruff.lint]
select = ["E", "F", "I", "N", "W", "UP", "B", "SIM", "RUF"]

[tool.pytest.ini_options]
testpaths = ["tests"]
addopts = "-v --tb=short"

[build-system]
requires = ["hatchling"]
build-backend = "hatchling.build"
```

**`.gitignore`**: `__pycache__`, `*.pyc`, `.venv`, `.mypy_cache`, `.ruff_cache`, `.pytest_cache`, `dist/`, `.env`

**`.pre-commit-config.yaml`**: ruff lint + format hooks

**`CLAUDE.md`**:

- Project: FlowOS — personal work management, markdown + git storage
- Run: `uv run flow <cmd>`, `uv run pytest`, `ruff check src/`, `ruff format src/`
- Layout: `src/` layout with `flowos` package, `data/` for runtime markdown files
- Convention: Pydantic models = single source of truth, `python-frontmatter` for I/O
- Convention: each new model/state/feature added only when a slice requires it
- Convention: Spanish + English bilingual support in parser/AI

**Directory structure**:

```
src/flowos/__init__.py
src/flowos/config.py
src/flowos/cli/__init__.py
src/flowos/cli/main.py
src/flowos/core/__init__.py
src/flowos/core/models.py
src/flowos/storage/__init__.py
src/flowos/storage/markdown.py
data/inbox/.gitkeep
data/tasks/.gitkeep
data/projects/.gitkeep
data/people/.gitkeep
data/weekly/.gitkeep
tests/__init__.py
tests/conftest.py
```

### Quality Gate

- [ ] `uv run flow --help` prints Typer help
- [ ] `uv run pytest` runs with 0 tests, exits clean
- [ ] `ruff check src/` passes
- [ ] Git repo initialized with first commit

---

## Slice 1: Capture -> Store -> View

**Goal**: `flow add "text"` saves to inbox, `flow inbox` lists items. The core loop works.

### Critical Files

**`src/flowos/config.py`**:

```python
from pathlib import Path
from pydantic import BaseModel

class FlowOSConfig(BaseModel):
    data_dir: Path = Path("data")

    @property
    def inbox_dir(self) -> Path:
        return self.data_dir / "inbox"

    @property
    def tasks_dir(self) -> Path:
        return self.data_dir / "tasks"

def load_config() -> FlowOSConfig:
    """Load config. For now, just returns defaults."""
    return FlowOSConfig()
```

**`src/flowos/core/models.py`** (Slice 1 only — minimal):

```python
from __future__ import annotations
from datetime import date
from enum import StrEnum
from pydantic import BaseModel, Field
import uuid

class InboxStatus(StrEnum):
    UNPROCESSED = "unprocessed"
    # Other statuses added when slices need them

class InboxItem(BaseModel):
    id: str = Field(default_factory=lambda: uuid.uuid4().hex[:8])
    raw_input: str
    status: InboxStatus = InboxStatus.UNPROCESSED
    created_at: date = Field(default_factory=date.today)
    source: str = "cli"

    @property
    def filename(self) -> str:
        return f"{self.created_at}-{self.id}.md"
```

**`src/flowos/storage/markdown.py`** (simple, no over-abstraction):

```python
from pathlib import Path
from typing import TypeVar, Type
import frontmatter
from pydantic import BaseModel

T = TypeVar("T", bound=BaseModel)
BODY_FIELD = "body"

def read_entity(path: Path, model_class: Type[T]) -> T:
    """Read markdown file with YAML frontmatter into a Pydantic model."""
    post = frontmatter.load(str(path))
    data = dict(post.metadata)
    if BODY_FIELD in model_class.model_fields:
        data[BODY_FIELD] = post.content
    return model_class.model_validate(data)

def write_entity(path: Path, entity: BaseModel) -> Path:
    """Write Pydantic model as markdown file with YAML frontmatter."""
    data = entity.model_dump(mode="json", exclude_none=True)
    body = data.pop(BODY_FIELD, "")
    post = frontmatter.Post(content=body, **data)
    path.parent.mkdir(parents=True, exist_ok=True)
    frontmatter.dump(post, str(path))
    return path

def list_entities(directory: Path, model_class: Type[T]) -> list[T]:
    """Read all .md files in directory into models. Skips malformed files."""
    if not directory.exists():
        return []
    results = []
    for md_file in sorted(directory.glob("*.md")):
        if md_file.name == ".gitkeep":
            continue
        try:
            results.append(read_entity(md_file, model_class))
        except Exception:
            continue
    return results
```

**`src/flowos/core/inbox.py`**:

```python
from flowos.core.models import InboxItem
from flowos.storage.markdown import write_entity, list_entities
from flowos.config import FlowOSConfig

class InboxManager:
    def __init__(self, config: FlowOSConfig):
        self.inbox_dir = config.inbox_dir

    def add(self, raw_input: str, source: str = "cli") -> InboxItem:
        item = InboxItem(raw_input=raw_input, source=source)
        write_entity(self.inbox_dir / item.filename, item)
        return item

    def list_all(self) -> list[InboxItem]:
        return list_entities(self.inbox_dir, InboxItem)
```

**`src/flowos/cli/main.py`**:

```python
import typer
from flowos.cli.inbox_cmd import inbox_app

app = typer.Typer(name="flow", help="FlowOS — capture, structure, progress.", no_args_is_help=True)
app.add_typer(inbox_app, name="inbox")

@app.command()
def add(text: list[str] = typer.Argument(..., help="Text to capture")):
    """Capture a thought into the inbox."""
    from flowos.config import load_config
    from flowos.core.inbox import InboxManager
    from rich.console import Console

    console = Console()
    config = load_config()
    manager = InboxManager(config)
    raw = " ".join(text)
    item = manager.add(raw)
    console.print(f"[green]captured[/green] -> {item.filename}")
```

**`src/flowos/cli/inbox_cmd.py`**:

```python
import typer
from rich.console import Console
from rich.table import Table

inbox_app = typer.Typer(help="Manage inbox.")
console = Console()

@inbox_app.callback(invoke_without_command=True)
def inbox_list(ctx: typer.Context):
    """List inbox items."""
    if ctx.invoked_subcommand is not None:
        return
    from flowos.config import load_config
    from flowos.core.inbox import InboxManager

    config = load_config()
    items = InboxManager(config).list_all()

    if not items:
        console.print("[dim]Inbox is empty.[/dim]")
        return

    table = Table(title="Inbox")
    table.add_column("ID", style="cyan", width=10)
    table.add_column("Date", width=12)
    table.add_column("Input")

    for item in items:
        table.add_row(item.id, str(item.created_at), item.raw_input[:60])
    console.print(table)
```

### Tests

**`tests/conftest.py`**: `tmp_data_dir` fixture that creates temp `inbox/`, `tasks/` dirs.

**`tests/test_models.py`**: InboxItem creation, defaults, filename format.

**`tests/test_storage.py`**: write_entity -> read_entity round-trip, list_entities with empty/mixed dirs.

**`tests/test_inbox.py`**: InboxManager.add creates file, list_all returns items.

**`tests/test_cli.py`**: `typer.testing.CliRunner` tests for `flow add` and `flow inbox`.

### Quality Gate

- [ ] `flow add hablar con Nico sobre wallet` creates file in `/data/inbox/`
- [ ] `flow inbox` shows the item in a Rich table
- [ ] All tests pass
- [ ] Capture 5+ real thoughts and verify they display correctly
- [ ] `ruff check` + `mypy` pass

---

## Slice 2: Process -> Suggest (Heuristic Parser)

**Goal**: `flow inbox process` runs heuristic parser on inbox items, writes suggestions back.

### New/Modified Files

**`src/flowos/core/models.py`** — add:

- `InboxStatus.PROCESSED` enum value
- `InboxSuggestion` model (suggested_type, person, project, title, priority, tags, confidence)
- Add `suggestion: InboxSuggestion | None = None` field to `InboxItem`

**`src/flowos/core/parser.py`**:

```python
import re
from flowos.core.models import InboxSuggestion

class ParserContext:
    def __init__(self, known_people: list[str] | None = None, known_projects: list[str] | None = None):
        self.known_people = [p.lower() for p in (known_people or [])]
        self.known_projects = [p.lower() for p in (known_projects or [])]

def parse_input(raw: str, context: ParserContext | None = None) -> InboxSuggestion:
    """Extract structured suggestions from raw text using heuristics."""
    suggestion = InboxSuggestion()
    lower = raw.lower()

    # Task detection (bilingual keywords)
    task_patterns = [
        r'\b(hacer|do|fix|send|review|talk|hablar|enviar|revisar|check|update|deploy)\b',
        r'\b(need to|hay que|should|must|todo)\b',
    ]
    if any(re.search(p, lower) for p in task_patterns):
        suggestion.suggested_type = "task"
        suggestion.confidence = 0.6

    # Priority: urgent/asap -> high, important -> medium
    if re.search(r'\b(urgent|urgente|asap|critical)\b', lower):
        suggestion.priority = "high"
    elif re.search(r'\b(important|importante)\b', lower):
        suggestion.priority = "medium"

    # @mentions -> person
    mention = re.search(r'@(\w+)', raw)
    if mention:
        suggestion.person = mention.group(1)

    # Known people matching
    if context and not suggestion.person:
        for person in context.known_people:
            if person in lower:
                suggestion.person = person
                break

    # #tags -> project + tags
    suggestion.tags = re.findall(r'#(\w+)', raw)
    if suggestion.tags:
        suggestion.project = suggestion.tags[0]

    # Known project matching
    if context and not suggestion.project:
        for project in context.known_projects:
            if project in lower:
                suggestion.project = project
                break

    # Title: first sentence or first 80 chars
    suggestion.title = raw.split('.')[0].split('\n')[0][:80].strip()

    return suggestion
```

**`src/flowos/core/inbox.py`** — add:

- `InboxManager.get(item_id)` — find by ID
- `InboxManager.update(item)` — overwrite file
- `InboxManager.process(item_id=None, all=False)` — runs parser, updates status to PROCESSED

**`src/flowos/cli/inbox_cmd.py`** — add:

- `flow inbox process [--all | <id>]` subcommand
- Update `flow inbox` table to show suggestion columns when present

### Quality Gate

- [ ] `flow inbox process --all` processes unprocessed items
- [ ] Suggestions written back to markdown files (visible in frontmatter)
- [ ] `flow inbox` shows suggestions in table
- [ ] Parser tests pass for: bilingual input, @mentions, #tags, priority keywords, empty input
- [ ] Process 5+ real captured items, verify suggestions make sense

---

## Slice 3: Convert -> Task

**Goal**: `flow inbox apply <id>` converts inbox item into a task file. `flow tasks` lists tasks.

### New/Modified Files

**`src/flowos/core/models.py`** — add:

- `InboxStatus.CONVERTED`, `InboxStatus.IGNORED` enum values
- `TaskStatus` enum (ACTIVE, DONE, CANCELLED)
- `Task` model (slug, title, status, assignee, project, priority, created_at, updated_at, body, source_inbox_id)

**`src/flowos/storage/markdown.py`** — add:

- `slugify(text)` — converts title to filesystem-safe slug
- `delete_entity(path)` — removes a file

**`src/flowos/core/tasks.py`**:

- `TaskManager.create(title, **kwargs)` — creates task file
- `TaskManager.from_inbox(item)` — converts inbox item using suggestions
- `TaskManager.list_all(status=None)` — lists tasks
- `TaskManager.get(slug)` — get by slug

**`src/flowos/core/inbox.py`** — add:

- `InboxManager.mark_converted(item_id)` — sets status to CONVERTED
- `InboxManager.mark_ignored(item_id)` — sets status to IGNORED

**`src/flowos/cli/inbox_cmd.py`** — add:

- `flow inbox apply <id>` — converts to task, marks inbox item as converted
- `flow inbox ignore <id>` — marks as ignored

**`src/flowos/cli/main.py`** — add:

- `flow tasks` command — lists tasks in Rich table

### Generated Task File (`/data/tasks/wallet-security.md`):

```markdown
---
slug: wallet-security
title: Hablar con Nico sobre seguridad del wallet
status: active
assignee: nico
project: wallet
priority: medium
created_at: "2026-04-09"
updated_at: "2026-04-09"
tags:
  - wallet
source_inbox_id: a1b2c3d4
---

## Origin

hablar con Nico sobre seguridad del wallet
```

### Quality Gate

- [ ] End-to-end: `flow add` -> `flow inbox process --all` -> `flow inbox apply <id>` -> `flow tasks` shows the task
- [ ] Task file created in `/data/tasks/` with correct frontmatter
- [ ] Inbox item marked as CONVERTED
- [ ] `flow inbox ignore <id>` works
- [ ] Slug collision handling works
- [ ] All tests pass

---

## Slice 4: AI Suggestions

**Goal**: AI-powered classification replaces/augments heuristic parser when available.

### New/Modified Files

**`src/flowos/core/ai.py`**:

```python
from typing import Protocol
from flowos.core.models import InboxSuggestion
from flowos.config import FlowOSConfig

class AIProvider(Protocol):
    def classify(self, raw_input: str, context: dict) -> InboxSuggestion: ...

class LiteLLMProvider:
    def __init__(self, config: FlowOSConfig):
        self.model = config.ai_model  # e.g. "ollama/llama3.1", "openai/gpt-4o-mini"

    def classify(self, raw_input: str, context: dict) -> InboxSuggestion:
        import litellm
        response = litellm.completion(
            model=self.model,
            messages=[
                {"role": "system", "content": self._system_prompt(context)},
                {"role": "user", "content": raw_input},
            ],
            response_format={"type": "json_object"},
            temperature=0.1,
        )
        return InboxSuggestion.model_validate_json(response.choices[0].message.content)

    def _system_prompt(self, context: dict) -> str:
        people = ", ".join(context.get("people", [])) or "none"
        projects = ", ".join(context.get("projects", [])) or "none"
        return f"""You are a work input classifier. Given raw text, extract structured info.
Known people: {people}
Known projects: {projects}
Respond JSON: {{"suggested_type":"task|note|unknown","person":"name|null",
"project":"slug|null","title":"concise title","priority":"high|medium|low|none",
"tags":["..."],"confidence":0.0-1.0}}
Input may be Spanish or English. Match against known entities when possible."""

class HeuristicFallback:
    def classify(self, raw_input: str, context: dict) -> InboxSuggestion:
        from flowos.core.parser import parse_input, ParserContext
        return parse_input(raw_input, ParserContext(
            known_people=context.get("people", []),
            known_projects=context.get("projects", []),
        ))

def get_ai_provider(config: FlowOSConfig) -> AIProvider:
    try:
        import litellm  # noqa: F401
        return LiteLLMProvider(config)
    except ImportError:
        return HeuristicFallback()
```

**`src/flowos/config.py`** — add:

- `ai_model: str = "ollama/llama3.1"` field

**`src/flowos/core/inbox.py`** — update:

- `process()` uses `get_ai_provider()` instead of direct parser call

### Quality Gate

- [ ] Without `[ai]` installed: falls back to heuristics (existing behavior)
- [ ] With `[ai]` installed: AI suggestions have higher confidence and richer extraction
- [ ] Mock tests for LiteLLMProvider (mock litellm.completion, test JSON parsing)
- [ ] Integration test with at least one real provider
- [ ] Re-process existing inbox items, compare AI vs heuristic quality

---

## Slice 5: Voice Capture

**Goal**: `flow add --voice` records microphone input, transcribes, and saves to inbox.

### New/Modified Files

**`src/flowos/cli/main.py`** — modify `add` command:

- Add `--voice / -v` flag
- When `--voice`: record audio from mic, send to Whisper API (OpenAI), transcribe, save result to inbox
- Use `source: "voice"` in the InboxItem

**Implementation approach**:

- Use `sounddevice` + `soundfile` for mic recording (add to `[voice]` optional deps)
- Use OpenAI Whisper API for transcription (via `openai` SDK in `[voice]` deps)
- Record until user presses Enter or max duration (30 seconds)
- Show Rich spinner during transcription
- Save temp `.wav` file, transcribe, delete after

### Quality Gate

- [ ] `flow add --voice` records, transcribes, and saves to inbox
- [ ] `flow inbox` shows voice-captured items with `source: voice`
- [ ] Manual test with real voice input in Spanish and English
- [ ] Graceful error if mic not available or API key missing

---

## Slice 6: Nudges + Status

**Goal**: `flow nudge` shows stale task reminders. `flow status` shows a compact dashboard.

### New/Modified Files

**`src/flowos/core/nudges.py`**:

```python
from dataclasses import dataclass
from datetime import date
from flowos.core.models import Task, TaskStatus
from flowos.core.tasks import TaskManager
from flowos.config import FlowOSConfig

@dataclass
class Nudge:
    task: Task
    nudge_type: str   # "remind" or "close_suggestion"
    days_stale: int
    message: str

class NudgeEngine:
    def __init__(self, config: FlowOSConfig, task_manager: TaskManager):
        self.task_manager = task_manager
        self.remind_days = 3
        self.close_days = 5

    def evaluate(self) -> list[Nudge]:
        today = date.today()
        nudges = []
        for task in self.task_manager.list_all(status=TaskStatus.ACTIVE):
            days = (today - task.updated_at).days
            if days >= self.close_days:
                nudges.append(Nudge(task=task, nudge_type="close_suggestion", days_stale=days,
                    message=f"'{task.title}' stale for {days}d. Close or update?"))
            elif days >= self.remind_days:
                nudges.append(Nudge(task=task, nudge_type="remind", days_stale=days,
                    message=f"Reminder: '{task.title}' — {days}d without update"))
        return nudges
```

**`src/flowos/config.py`** — add:

- `nudge_remind_days: int = 3`
- `nudge_close_days: int = 5`

**`src/flowos/cli/nudge_cmd.py`**: `flow nudge` — Rich table of stale tasks with nudge type and message.

**`src/flowos/cli/status_cmd.py`**: `flow status` — Rich panels showing:

- Inbox: X unprocessed
- Tasks: X active, X done
- Nudges: X reminders, X close suggestions

### Quality Gate

- [ ] `flow nudge` shows stale tasks correctly
- [ ] `flow status` shows accurate counts
- [ ] Tests with mocked dates (tasks at 0, 3, 5, 10 days)
- [ ] Can run via cron: `*/30 * * * * cd ~/flowOS && uv run flow nudge`

---

## MVP Complete Boundary

After Slice 6, the MVP is complete. The following are TODO for post-MVP:

---

## TODO: Post-MVP Slices

### Slice 7: FastAPI (HTTP API)

- `src/flowos/api/app.py` — FastAPI factory wrapping same core managers
- Routes: `GET/POST /inbox`, `POST /inbox/process`, `POST /inbox/apply/{id}`, `GET/POST /tasks`
- Run with: `uv run --extra api uvicorn flowos.api.app:app --reload`
- Thin wrappers — zero business logic in routes

### Slice 8: Next.js UI

- `/ui` folder with Next.js App Router + Tailwind
- Views: Inbox (list + process + apply), Tasks (list + status), Status dashboard
- Talks to FastAPI server via fetch wrapper

### Slice 9: Projects + People (Team Features)

- `Project` and `Person` models
- `ProjectManager`, `PeopleManager`
- CLI commands: `flow projects`, `flow people`
- Assignee and project linking

### Slice 10: Weekly Reviews

- `/data/weekly/YYYY-WXX.md` generation
- Weekly summary command: `flow weekly`
- Auto-generate from task activity

### Slice 11: Git Auto-Commit

- `storage/git.py` — auto-commit after mutations
- Configurable: on/off, commit message templates

### Slice 12: Context Enrichment

- Add info to existing projects/tasks from new inputs
- Avoid duplication
- AI-powered deduplication and merging

---

## Verification Plan

### Per-Slice Verification

At each slice boundary, run:

```bash
uv run ruff check src/
uv run ruff format --check src/
uv run mypy src/flowos/
uv run pytest -v --tb=short
```

### End-to-End Smoke Test (after Slice 3)

```bash
# Full capture-to-task flow
flow add "hablar con @nico sobre seguridad del #wallet urgente"
flow inbox
flow inbox process --all
flow inbox
flow inbox apply <id>
flow tasks
```

### Real Usage Validation

After each slice, use FlowOS for real work capture for at least a session before advancing to the next slice. Note friction points to inform the next slice's design.

---

## Critical Files Reference

| File                             | Purpose                          | First Slice |
| -------------------------------- | -------------------------------- | ----------- |
| `src/flowos/core/models.py`      | All Pydantic domain models       | 1           |
| `src/flowos/storage/markdown.py` | Read/write markdown+frontmatter  | 1           |
| `src/flowos/core/inbox.py`       | InboxManager — capture + process | 1           |
| `src/flowos/cli/main.py`         | Typer root app + `flow add`      | 1           |
| `src/flowos/cli/inbox_cmd.py`    | `flow inbox` subcommands         | 1           |
| `src/flowos/core/parser.py`      | Heuristic parser                 | 2           |
| `src/flowos/core/tasks.py`       | TaskManager — CRUD + conversion  | 3           |
| `src/flowos/core/ai.py`          | LiteLLM + fallback               | 4           |
| `src/flowos/core/nudges.py`      | NudgeEngine                      | 6           |
| `src/flowos/config.py`           | FlowOSConfig (grows per slice)   | 0           |
| `CLAUDE.md`                      | Project conventions + commands   | 0           |
