export interface ThemeColors {
  bg: string
  bgSecondary: string
  bgSidebar: string
  text: string
  textSecondary: string
  border: string
  accent: string
  accentText: string
  syntaxHighlight: string
}

export interface Theme {
  id: string
  name: string
  colors: ThemeColors
  builtIn: boolean
}

export const builtInThemes: Theme[] = [
  {
    id: "default",
    name: "Default",
    builtIn: true,
    // Default Lumen dark theme (Radix sand/cyan)
    colors: {
      bg: "#111110",
      bgSecondary: "#1a1918",
      bgSidebar: "#1c1b1a",
      text: "#eeeeec",
      textSecondary: "#a0a09b",
      border: "#3a3935",
      accent: "#0ac5b3",
      accentText: "#0ac5b3",
      syntaxHighlight: "#0ac5b3",
    },
  },
  {
    id: "github",
    name: "GitHub",
    builtIn: true,
    // GitHub dark mode (Primer v2 design system, 2024)
    // Sources: github.com/primer/primitives, primer.style/design/foundations/color
    colors: {
      bg: "#0d1117",
      bgSecondary: "#151b23",
      bgSidebar: "#171e28",
      text: "#f0f6fc",
      textSecondary: "#9198a1",
      border: "#3d444d",
      accent: "#4493f8",
      accentText: "#4493f8",
      syntaxHighlight: "#4493f8",
    },
  },
  {
    id: "notion",
    name: "Notion",
    builtIn: true,
    // Notion dark mode colors
    // Sources: matthiasfrank.de/en/notion-colors
    colors: {
      bg: "#191919",
      bgSecondary: "#252525",
      bgSidebar: "#1f1f1f",
      text: "#d4d4d4",
      textSecondary: "#9b9b9b",
      border: "#2f2f2f",
      accent: "#447acb",
      accentText: "#447acb",
      syntaxHighlight: "#447acb",
    },
  },
  {
    id: "vscode",
    name: "VS Code",
    builtIn: true,
    // VS Code Dark theme (2025)
    // Sources: github.com/microsoft/vscode, extensions/theme-defaults/themes
    colors: {
      bg: "#121314",
      bgSecondary: "#191a1b",
      bgSidebar: "#1c1d1e",
      text: "#bbbebf",
      textSecondary: "#8c8c8c",
      border: "#2a2b2c",
      accent: "#3994bc",
      accentText: "#48a0c7",
      syntaxHighlight: "#3994bc",
    },
  },
  {
    id: "obsidian",
    name: "Obsidian",
    builtIn: true,
    // Obsidian default dark theme
    // Sources: docs.obsidian.md/Reference/CSS+variables, publish.obsidian.md/hub
    colors: {
      bg: "#202020",
      bgSecondary: "#161616",
      bgSidebar: "#282828",
      text: "#dcddde",
      textSecondary: "#999999",
      border: "#333333",
      accent: "#7f6df2",
      accentText: "#a68df4",
      syntaxHighlight: "#7f6df2",
    },
  },
  {
    id: "craft",
    name: "Craft",
    builtIn: true,
    // Craft macOS app dark mode
    // Sources: mobbin.com/colors/brand/craft-docs, support.craft.do
    colors: {
      bg: "#111827",
      bgSecondary: "#1f2937",
      bgSidebar: "#1c2439",
      text: "#f9fafb",
      textSecondary: "#9ca3af",
      border: "#374151",
      accent: "#3555ff",
      accentText: "#5b7aff",
      syntaxHighlight: "#3555ff",
    },
  },
]

function mixColor(hex: string, mixHex: string, amount: number): string {
  const r1 = parseInt(hex.slice(1, 3), 16)
  const g1 = parseInt(hex.slice(3, 5), 16)
  const b1 = parseInt(hex.slice(5, 7), 16)
  const r2 = parseInt(mixHex.slice(1, 3), 16)
  const g2 = parseInt(mixHex.slice(3, 5), 16)
  const b2 = parseInt(mixHex.slice(5, 7), 16)
  const r = Math.round(r1 + (r2 - r1) * amount)
  const g = Math.round(g1 + (g2 - g1) * amount)
  const b = Math.round(b1 + (b2 - b1) * amount)
  return `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${b.toString(16).padStart(2, "0")}`
}

function hexToRgba(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}

/**
 * Generate all CSS variable overrides from the 8 core theme colors (dark mode only).
 */
function generateCssVariables(colors: ThemeColors): Record<string, string> {
  const white = "#ffffff"
  const black = "#000000"

  return {
    "--color-bg": colors.bg,
    "--color-bg-sidebar": colors.bgSidebar ?? colors.bgSecondary,
    "--color-bg-inset": mixColor(colors.bg, black, 0.3),
    "--color-bg-card": colors.bgSecondary,
    "--color-bg-overlay": mixColor(colors.bgSecondary, white, 0.05),
    "--color-bg-backdrop": hexToRgba(colors.bg, 0.8),
    "--color-bg-overlay-backdrop": hexToRgba(colors.bgSecondary, 0.8),
    "--color-bg-hover": hexToRgba(white, 0.06),
    "--color-bg-active": hexToRgba(white, 0.09),
    "--color-bg-secondary": hexToRgba(white, 0.06),
    "--color-bg-secondary-hover": hexToRgba(white, 0.09),
    "--color-bg-secondary-active": hexToRgba(white, 0.12),
    "--color-bg-tertiary": hexToRgba(white, 0.09),
    "--color-bg-code-block": hexToRgba(white, 0.04),
    "--color-bg-highlight": hexToRgba("#facc15", 0.2),
    "--color-bg-selection": hexToRgba(colors.accent, 0.2),
    "--color-text": colors.text,
    "--color-text-secondary": colors.textSecondary,
    "--color-text-tertiary": mixColor(colors.textSecondary, colors.bg, 0.2),
    "--color-text-highlight": "#fde047",
    "--color-text-selection": colors.accentText,
    "--color-text-success": "#4ade80",
    "--color-text-danger": "#f87171",
    "--color-text-pending": "#facc15",
    "--color-text-pinned": "#fb923c",
    "--color-border": colors.border,
    "--color-border-secondary": hexToRgba(white, 0.08),
    "--color-border-table": colors.border,
    "--color-border-focus": colors.accent,
    "--color-syntax-cyan": colors.syntaxHighlight,
    "--color-syntax-red": "#f87171",
    "--color-syntax-purple": "#c084fc",
    "--color-syntax-green": "#4ade80",
  }
}

/**
 * Apply a theme by setting CSS variables on the document root.
 * Pass null to remove theme overrides (revert to default).
 */
export function applyTheme(theme: Theme | null): void {
  const root = document.documentElement

  if (!theme || theme.id === "default") {
    root.removeAttribute("data-theme")
    const allVars = generateCssVariables(builtInThemes[0].colors)
    for (const key of Object.keys(allVars)) {
      root.style.removeProperty(key)
    }
    // Sidebar color needs an explicit override since the CSS default
    // (neutral-3) is a generic Radix step — set the theme-specific value.
    root.style.setProperty("--color-bg-sidebar", builtInThemes[0].colors.bgSidebar)
    return
  }

  root.setAttribute("data-theme", theme.id)

  const vars = generateCssVariables(theme.colors)
  for (const [key, value] of Object.entries(vars)) {
    root.style.setProperty(key, value)
  }
}

/**
 * Get all available themes (built-in + custom).
 */
export function getAllThemes(customThemes: Theme[]): Theme[] {
  return [...builtInThemes, ...customThemes]
}
