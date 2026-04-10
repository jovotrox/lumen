# FlowOS + Lumen — Design Spec

## Context

Lumen is a markdown-first, Git-backed note-taking app. FlowOS is a work management system PRD focused on frictionless capture → automatic structuring → intelligent follow-up. Instead of building FlowOS as a separate project, we integrate its core concepts into Lumen's existing architecture.

**Philosophy**: Everything remains a markdown note with frontmatter. Intelligence comes from AI classification, smart frontmatter conventions, and derived views. "Write first, structure later."

**User profile**: Solo user managing personal work. People/projects are reference entities for organization, not shared collaboration.

## Phases

1. Entities (Project + Person) + Mention Picker
2. Smart Inbox + Quick Note Dual Mode + AI Classification
3. Status Dashboard
4. Nudges (UI banner + Tauri notifications)

See implementation plans in `docs/superpowers/plans/` for each phase.
