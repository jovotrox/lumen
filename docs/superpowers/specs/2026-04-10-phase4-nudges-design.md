# Phase 4: Nudges — Design Spec

## Overview

Proactive nudges that surface in the Home dashboard and as Tauri native notifications when items need attention. Four nudge types: stale tasks, inactive projects, accumulated inbox, and overdue follow-ups.

## Nudge Types

### 1. Stale Tasks

Tasks not completed after N days. Detected by comparing task creation date (from the note's `updatedAt` or the task's `date` field) against today.

- Default threshold: **7 days**
- Shows: task text, source note, days stale

### 2. Inactive Projects

Projects with `status: active` that have no task completions or edits in N days.

- Default threshold: **14 days**
- Shows: project name, days since last activity

### 3. Accumulated Inbox

Inbox items pile up beyond N unprocessed.

- Default threshold: **5 items**
- Shows: count of unprocessed items

### 4. Overdue Follow-ups

Tasks with a `date` field that is in the past and still incomplete.

- No configurable threshold — any past-due task qualifies
- Shows: task text, due date, days overdue, source note

## Where Nudges Appear

### Dashboard Section

A "Nudges" card between the greeting and the action cards. Uses `AlertTriangle` icon. Each nudge is a compact line with icon, message, and link to act on it. Hidden when no nudges exist.

### Tauri Native Notifications

On app launch (when the main window gains focus), if there are nudges, fire a single grouped notification:

- Title: "Lumen — X items need attention"
- Body: Summary of top 3 nudges
- Only fires once per day (tracked via localStorage timestamp)
- Only in Tauri (not web)

## Settings

New "Nudges" section in Settings with threshold controls:

| Setting               | Type         | Default | Storage Key                   |
| --------------------- | ------------ | ------- | ----------------------------- |
| Stale task days       | number input | 7       | `nudge_stale_task_days`       |
| Inactive project days | number input | 14      | `nudge_inactive_project_days` |
| Inbox threshold       | number input | 5       | `nudge_inbox_threshold`       |
| Native notifications  | toggle       | true    | `nudge_notifications_enabled` |

## Architecture

### Files

| File                                | Purpose                                          |
| ----------------------------------- | ------------------------------------------------ |
| `src/utils/nudges.ts`               | Pure functions: detect each nudge type from data |
| `src/global-state.ts`               | Settings atoms + `nudgesAtom` (derived)          |
| `src/components/dashboard-view.tsx` | Nudges section in dashboard                      |
| `src/routes/_appRoot.tsx`           | Tauri notification on focus                      |
| `src/routes/_appRoot.settings.tsx`  | Nudge threshold settings UI                      |

### State

```ts
// Settings atoms
nudgeStaleTaskDaysAtom // atomWithStorage, default 7
nudgeInactiveProjectDaysAtom // atomWithStorage, default 14
nudgeInboxThresholdAtom // atomWithStorage, default 5
nudgeNotificationsAtom // atomWithStorage, default true

// Derived
nudgesAtom // reads all data + settings, returns Nudge[]
```

### Nudge Type

```ts
type Nudge = {
  type: "stale_task" | "inactive_project" | "inbox_pileup" | "overdue_followup"
  message: string
  noteId?: string // link target
  priority: number // for sorting (1=highest)
}
```
