<p align="center">
  <img src="public/icon-1024.png" alt="Lumen" width="128" height="128" />
</p>

<h1 align="center">Lumen</h1>

<p align="center">
  <strong>Your brain, organized. Notes that think with you.</strong>
</p>

<p align="center">
  <a href="https://github.com/jovotrox/lumen/releases/latest"><img src="https://img.shields.io/github/v/release/jovotrox/lumen?style=flat-square&label=download&color=FF715B" alt="Download" /></a>
  <a href="https://github.com/jovotrox/lumen/actions/workflows/ci.yml"><img src="https://img.shields.io/github/actions/workflow/status/jovotrox/lumen/ci.yml?style=flat-square&label=ci" alt="CI" /></a>
  <a href="https://github.com/jovotrox/lumen/blob/personal/LICENSE"><img src="https://img.shields.io/github/license/jovotrox/lumen?style=flat-square" alt="License" /></a>
  <img src="https://img.shields.io/badge/platform-macOS%20%7C%20Windows%20%7C%20Linux%20%7C%20Web-333?style=flat-square" alt="Platform" />
  <img src="https://img.shields.io/badge/electron-35-47848F?style=flat-square&logo=electron&logoColor=white" alt="Electron" />
  <img src="https://img.shields.io/badge/react-18-61DAFB?style=flat-square&logo=react&logoColor=white" alt="React" />
</p>

---

## What is Lumen?

Lumen is a note-taking app for people who think in connections. Built on plain Markdown files synced through GitHub, it combines the simplicity of a text editor with the power of a personal knowledge system.

**Desktop app** (Electron) with native menubar, tabs, system tray, and global shortcuts. **Web app** (PWA) that works offline from any browser. Same notes, everywhere.

## Features

**Core**

- Markdown notes with wikilinks `[[note]]`, tags `#tag`, and templates
- GitHub sync — your notes live in a Git repo you own
- Full-text search with fuzzy matching
- Daily & weekly notes with calendar navigation

**Editor**

- Live preview (WYSIWYG) with dimmed markers on active line
- Floating format toolbar on text selection
- Keyboard shortcuts (Cmd+B, Cmd+I, Cmd+K, etc.)
- Slash commands `/` for quick block insertion
- Vim mode (optional)

**Organization**

- Projects & People as first-class note types
- Smart Inbox with AI classification (OpenAI, Claude, or Ollama)
- Home dashboard with weather, tasks, and nudges
- Backlinks and related notes

**Desktop (Electron)**

- Native menubar with all shortcuts
- Notion-style tabs in the titlebar
- Quick Note capture (Option+Shift+N) — even when the app is hidden
- System tray — always one shortcut away
- macOS Calendar.app integration in daily notes
- Auto-updates via GitHub Releases
- Deep links: `lumen://note/my-note`

**Themes**

- 6 built-in themes: Default, GitHub, Notion, VS Code, Obsidian, Craft
- Custom theme creator with live preview
- Settings sync across devices via `.lumen/settings.json`

## Install

### Desktop

Download the latest release for your platform:

| Platform | Download                                                         |
| -------- | ---------------------------------------------------------------- |
| macOS    | [`.dmg`](https://github.com/jovotrox/lumen/releases/latest)      |
| Windows  | [`.exe`](https://github.com/jovotrox/lumen/releases/latest)      |
| Linux    | [`.AppImage`](https://github.com/jovotrox/lumen/releases/latest) |

### Web / Mobile (PWA)

Open [jovotrox.github.io/lumen](https://jovotrox.github.io/lumen/) in any browser. On mobile, use "Add to Home Screen" for an app-like experience.

## Development

```bash
# Web development
npm run dev

# Electron development
npm run electron:dev

# Build
npm run build              # Web
npm run electron:build     # Desktop (all platforms)

# Quality
npm run test
npm run lint
npm run format
```

## Architecture

```
Frontend (React + TypeScript + Vite)
├── GitHub Pages (auto-deploy on push)     ← 90% of changes
├── Electron shell (native features)       ← occasional releases
└── PWA (offline, mobile)                  ← same codebase

Notes storage: Git repo (your GitHub account)
State: Jotai + XState
Editor: CodeMirror 6
Routing: TanStack Router
Styling: Tailwind CSS
```

**Hybrid update model:** The frontend loads from GitHub Pages (instant updates). Only Electron main process changes require a release — and those auto-update silently.

## Stack

| Layer    | Technology                       |
| -------- | -------------------------------- |
| Frontend | React 18, TypeScript, Vite       |
| Editor   | CodeMirror 6 + custom extensions |
| State    | Jotai + XState                   |
| Styling  | Tailwind CSS                     |
| Routing  | TanStack Router                  |
| Desktop  | Electron 35, electron-builder    |
| Git      | isomorphic-git + lightning-fs    |
| AI       | OpenAI, Claude, Ollama (local)   |
| CI/CD    | GitHub Actions, GitHub Pages     |

## Credits

Fork of [lumen-notes/lumen](https://github.com/lumen-notes/lumen) — the original distraction-free note-taking app. This fork adds the desktop shell, AI features, and the organizational layer.

---

<p align="center">
  <sub>Made with care by <a href="https://github.com/jovotrox">@jovotrox</a></sub>
</p>
