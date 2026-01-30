import { createFileRoute, Link, useNavigate } from "@tanstack/react-router"
import { useAtom, useAtomValue } from "jotai"
import React, { useState } from "react"
import { useNetworkState } from "react-use"
import { Button } from "../components/button"
import { Dialog } from "../components/dialog"
import { useSignOut } from "../components/github-auth"
import { GitHubAvatar } from "../components/github-avatar"
import { LoadingIcon16, SettingsIcon16 } from "../components/icons"
import { OpenAIKeyInput } from "../components/openai-key-input"
import { PageLayout } from "../components/page-layout"
import { RepoForm } from "../components/repo-form"
import { Signature } from "../components/signature"
import { SegmentedControl } from "../components/segmented-control"
import { Switch } from "../components/switch"
import {
  customThemesAtom,
  defaultFontAtom,
  epaperAtom,
  githubRepoAtom,
  githubUserAtom,
  hasOpenAIKeyAtom,
  isCloningRepoAtom,
  isRepoClonedAtom,
  isRepoNotClonedAtom,
  themeAtom,
  vimModeAtom,
  voiceAssistantEnabledAtom,
} from "../global-state"
import { cx } from "../utils/cx"
import { saveCustomThemes } from "../hooks/use-theme-sync"
import { builtInThemes, getAllThemes, type Theme, type ThemeColors } from "../utils/themes"

export const Route = createFileRoute("/_appRoot/settings")({
  component: RouteComponent,
  head: () => ({
    meta: [{ title: "Settings · Lumen" }],
  }),
})

function RouteComponent() {
  return (
    <PageLayout title="Settings" icon={<SettingsIcon16 />} disableGuard>
      <div className="p-4 pb-6">
        <div className="mx-auto flex max-w-xl flex-col gap-6">
          <GitHubSection />
          <AppearanceSection />
          <EditorSection />
          <AISection />
          <div className="p-5 text-text-tertiary self-center flex flex-col gap-3 items-center">
            <span className="text-sm">
              Made by{" "}
              <a
                className="link decoration-text-tertiary"
                href="https://colebemis.com"
                target="_blank"
                rel="noopener noreferrer"
              >
                Cole Bemis
              </a>{" "}
              &{" "}
              <a
                className="link decoration-text-tertiary"
                href="https://github.com/lumen-notes/lumen/graphs/contributors"
                target="_blank"
                rel="noopener noreferrer"
              >
                friends
              </a>
            </span>
            <a href="https://colebemis.com" target="_blank" rel="noopener noreferrer">
              <Signature width={100} />
            </a>
          </div>
        </div>
      </div>
    </PageLayout>
  )
}

function SettingsSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-3">
      <h3 className="font-bold leading-4">{title}</h3>
      <div className="card-1 p-4">{children}</div>
    </div>
  )
}

function GitHubSection() {
  const navigate = useNavigate()
  const githubUser = useAtomValue(githubUserAtom)
  const githubRepo = useAtomValue(githubRepoAtom)
  const isRepoNotCloned = useAtomValue(isRepoNotClonedAtom)
  const isCloningRepo = useAtomValue(isCloningRepoAtom)
  const isRepoCloned = useAtomValue(isRepoClonedAtom)
  const signOut = useSignOut()
  const { online } = useNetworkState()
  const [isEditingRepo, setIsEditingRepo] = useState(false)

  if (!githubUser) {
    return (
      <SettingsSection title="GitHub">
        <div className="text-text-secondary">You're not signed in.</div>
      </SettingsSection>
    )
  }

  return (
    <SettingsSection title="GitHub">
      <div className="flex items-center justify-between gap-4">
        <div className="flex w-0 grow flex-col gap-1">
          <span className="text-sm leading-4 text-text-secondary">Account</span>
          <span className="flex items-center gap-2 leading-4">
            {online ? <GitHubAvatar login={githubUser.login} size={16} /> : null}
            <span className="truncate">{githubUser.login}</span>
          </span>
        </div>
        <Button
          className="shrink-0"
          onClick={() => {
            signOut()
            navigate({ to: "/", search: { query: undefined, view: "grid" } })
          }}
        >
          Sign out
        </Button>
      </div>
      <div className="mt-4 border-t border-border-secondary pt-4 empty:hidden">
        {isRepoNotCloned || isEditingRepo ? (
          <RepoForm
            onSubmit={() => setIsEditingRepo(false)}
            onCancel={!isRepoNotCloned ? () => setIsEditingRepo(false) : undefined}
          />
        ) : null}
        {isCloningRepo && githubRepo ? (
          <div className="flex items-center gap-2 leading-4 text-text-secondary">
            <LoadingIcon16 />
            Cloning {githubRepo.owner}/{githubRepo.name}…
          </div>
        ) : null}
        {isRepoCloned && !isEditingRepo && githubRepo ? (
          <div className="flex items-center justify-between gap-4">
            <div className="flex w-0 grow flex-col items-start gap-1">
              <span className="text-sm leading-4 text-text-secondary">Repository</span>
              <a
                href={`https://github.com/${githubRepo.owner}/${githubRepo.name}`}
                className="link leading-5"
                target="_blank"
                rel="noopener noreferrer"
              >
                {githubRepo.owner}/{githubRepo.name}
              </a>
            </div>
            <Button className="shrink-0" onClick={() => setIsEditingRepo(true)}>
              Change
            </Button>
          </div>
        ) : null}
      </div>
    </SettingsSection>
  )
}

function AppearanceSection() {
  const [epaper, setEpaper] = useAtom(epaperAtom)
  const [font, setFont] = useAtom(defaultFontAtom)
  const [themeId, setThemeId] = useAtom(themeAtom)
  const [customThemes, setCustomThemes] = useAtom(customThemesAtom)
  const [themeDialogOpen, setThemeDialogOpen] = useState(false)
  const [editingTheme, setEditingTheme] = useState<Theme | undefined>(undefined)

  const allThemes = getAllThemes(customThemes)

  const handleDeleteTheme = (id: string) => {
    setCustomThemes((prev) => {
      const updated = prev.filter((t) => t.id !== id)
      saveCustomThemes(updated)
      return updated
    })
    if (themeId === id) setThemeId("default")
  }

  const handleSaveCustomTheme = (theme: Theme) => {
    setCustomThemes((prev) => {
      const existing = prev.findIndex((t) => t.id === theme.id)
      let updated: Theme[]
      if (existing >= 0) {
        updated = [...prev]
        updated[existing] = theme
      } else {
        updated = [...prev, theme]
      }
      saveCustomThemes(updated)
      return updated
    })
    setThemeId(theme.id)
    setThemeDialogOpen(false)
    setEditingTheme(undefined)
  }

  const openCreateDialog = () => {
    setEditingTheme(undefined)
    setThemeDialogOpen(true)
  }

  const openEditDialog = (id: string) => {
    setEditingTheme(customThemes.find((t) => t.id === id))
    setThemeDialogOpen(true)
  }

  return (
    <SettingsSection title="Appearance">
      <div className="flex items-center gap-2.5 leading-4">
        <Switch id="epaper" checked={epaper} onCheckedChange={setEpaper} />
        <label htmlFor="epaper" className="select-none">
          E-paper
        </label>
      </div>
      <div role="separator" className="h-px bg-border-secondary mt-4" />
      <div className="flex items-center justify-between mt-4">
        <span className="leading-4">Font style</span>
        <SegmentedControl aria-label="Font style" size="small">
          <SegmentedControl.Segment
            selected={font === "sans"}
            onClick={() => setFont("sans")}
            className="font-sans"
          >
            Sans
          </SegmentedControl.Segment>
          <SegmentedControl.Segment
            selected={font === "serif"}
            onClick={() => setFont("serif")}
            className="font-serif"
          >
            Serif
          </SegmentedControl.Segment>
          <SegmentedControl.Segment
            selected={font === "handwriting"}
            onClick={() => setFont("handwriting")}
            className="font-handwriting"
          >
            Hand
          </SegmentedControl.Segment>
          <SegmentedControl.Segment
            selected={font === "mono"}
            onClick={() => setFont("mono")}
            style={{ fontFamily: "var(--font-family-monospace)" }}
          >
            Mono
          </SegmentedControl.Segment>
        </SegmentedControl>
      </div>
      <div role="separator" className="h-px bg-border-secondary mt-4" />
      <div className="flex items-center justify-between mt-4">
        <span className="leading-4">Theme</span>
        <div className="flex items-center gap-2">
          <select
            value={themeId}
            onChange={(e) => setThemeId(e.target.value)}
            className="rounded-md border border-border bg-bg px-2 py-1 text-sm leading-5"
          >
            {allThemes.map((theme) => (
              <option key={theme.id} value={theme.id}>
                {theme.name}
              </option>
            ))}
          </select>
          {!builtInThemes.find((t) => t.id === themeId) && themeId !== "default" ? (
            <div className="flex gap-1">
              <button
                onClick={() => openEditDialog(themeId)}
                className="text-xs text-text-secondary hover:text-text"
              >
                Edit
              </button>
              <button
                onClick={() => handleDeleteTheme(themeId)}
                className="text-xs text-text-danger hover:text-text-danger"
              >
                Delete
              </button>
            </div>
          ) : null}
        </div>
      </div>
      <button
        onClick={openCreateDialog}
        className="mt-2 text-sm text-text-secondary hover:text-text"
      >
        + Create custom theme
      </button>
      <Dialog
        open={themeDialogOpen}
        onOpenChange={(open) => {
          setThemeDialogOpen(open)
          if (!open) setEditingTheme(undefined)
        }}
      >
        <Dialog.Content title={editingTheme ? "Edit theme" : "Create custom theme"}>
          <CustomThemeForm
            theme={editingTheme}
            onSave={handleSaveCustomTheme}
            onCancel={() => {
              setThemeDialogOpen(false)
              setEditingTheme(undefined)
            }}
          />
        </Dialog.Content>
      </Dialog>
    </SettingsSection>
  )
}

const defaultCustomColors: ThemeColors = {
  bg: "#1e1e1e",
  bgSecondary: "#252526",
  text: "#d4d4d4",
  textSecondary: "#858585",
  border: "#3c3c3c",
  accent: "#007acc",
  accentText: "#3794ff",
  syntaxHighlight: "#3794ff",
}

const colorLabels: Record<keyof ThemeColors, string> = {
  bg: "Background",
  bgSecondary: "Background secondary",
  text: "Text",
  textSecondary: "Text secondary",
  border: "Border",
  accent: "Accent",
  accentText: "Accent text",
  syntaxHighlight: "Syntax highlight",
}

function CustomThemeForm({
  theme,
  onSave,
  onCancel,
}: {
  theme?: Theme
  onSave: (theme: Theme) => void
  onCancel: () => void
}) {
  const [name, setName] = useState(theme?.name ?? "")
  const [colors, setColors] = useState<ThemeColors>(theme?.colors ?? defaultCustomColors)

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) return

    const id = theme?.id ?? `custom-${Date.now()}`
    onSave({
      id,
      name: name.trim(),
      colors,
      builtIn: false,
    })
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <label htmlFor="theme-name" className="text-sm text-text-secondary">
          Theme name
        </label>
        <input
          id="theme-name"
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="My custom theme"
          className="rounded-md border border-border bg-bg px-2 py-1 text-sm"
          required
        />
      </div>
      <ColorInputGrid colors={colors} onChange={setColors} />
      <div className="flex gap-2">
        <Button type="submit" variant="primary" size="small">
          Save
        </Button>
        <Button type="button" size="small" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </form>
  )
}

function ColorInputGrid({
  colors,
  onChange,
}: {
  colors: ThemeColors
  onChange: (colors: ThemeColors) => void
}) {
  const keys = Object.keys(colorLabels) as (keyof ThemeColors)[]

  return (
    <div className="grid grid-cols-2 gap-2">
      {keys.map((key) => (
        <div key={key} className="flex items-center gap-2">
          <input
            type="color"
            value={colors[key]}
            onChange={(e) => onChange({ ...colors, [key]: e.target.value })}
            className="h-6 w-6 shrink-0 cursor-pointer rounded border border-border"
          />
          <div className="flex flex-col">
            <span className="text-xs text-text-secondary">{colorLabels[key]}</span>
            <input
              type="text"
              value={colors[key]}
              onChange={(e) => {
                const val = e.target.value
                if (/^#[0-9a-fA-F]{0,6}$/.test(val)) {
                  onChange({ ...colors, [key]: val })
                }
              }}
              className="w-20 bg-transparent text-xs"
              pattern="^#[0-9a-fA-F]{6}$"
            />
          </div>
        </div>
      ))}
    </div>
  )
}

function EditorSection() {
  const [vimMode, setVimMode] = useAtom(vimModeAtom)

  return (
    <SettingsSection title="Editor">
      <div className="flex items-center gap-2.5 leading-4">
        <Switch id="vim-mode" checked={vimMode} onCheckedChange={setVimMode} />
        <label htmlFor="vim-mode" className="select-none">
          Vim mode
        </label>
      </div>
    </SettingsSection>
  )
}

function AISection() {
  const hasOpenAIKey = useAtomValue(hasOpenAIKeyAtom)
  const [voiceAssistantEnabled, setVoiceAssistantEnabled] = useAtom(voiceAssistantEnabledAtom)

  return (
    <SettingsSection title="AI">
      <div className="flex flex-col gap-4">
        <OpenAIKeyInput />
        <div role="separator" className="h-px bg-border-secondary" />
        <div className="flex flex-col gap-3 leading-4 coarse:gap-4">
          <div className="flex items-start gap-2.5">
            <Switch
              id="voice-assistant"
              disabled={!hasOpenAIKey}
              checked={hasOpenAIKey && voiceAssistantEnabled}
              onCheckedChange={(checked) => setVoiceAssistantEnabled(checked)}
            />
            <div className="flex flex-col gap-2 leading-4 coarse:leading-5">
              <label
                htmlFor="voice-assistant"
                className={cx(
                  "select-none",
                  !hasOpenAIKey && "cursor-not-allowed text-text-secondary",
                )}
              >
                Voice assistant <span className="italic text-text-secondary">(beta)</span>
              </label>
              <Link
                to="/notes/$"
                params={{ _splat: ".lumen/voice-instructions" }}
                search={{ mode: "write", query: undefined, view: "grid" }}
                className="link text-text-secondary"
              >
                Custom instructions
              </Link>
            </div>
          </div>
        </div>
      </div>
    </SettingsSection>
  )
}
