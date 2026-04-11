import { Extension } from "@codemirror/state"
import { EditorView, ViewPlugin } from "@codemirror/view"

/**
 * Autocomplete dropdown theme — matches DropdownMenu component exactly.
 *
 * Two-pronged approach:
 * 1. EditorView.theme() for structural styles (specificity over CM baseTheme)
 * 2. Injected <style> tag for backdrop-filter (style-mod mangles vendor prefixes)
 *
 * CM uses <completion-section> custom HTML elements for section headers.
 */

// Inject raw CSS via a ViewPlugin that adds a <style> tag once
const backdropCSS = ViewPlugin.define(() => {
  const style = document.createElement("style")
  style.textContent = `
    .cm-tooltip.cm-tooltip-autocomplete {
      background-color: var(--color-bg-overlay-backdrop) !important;
      backdrop-filter: blur(16px) !important;
      -webkit-backdrop-filter: blur(16px) !important;
    }
    .cm-tooltip.cm-tooltip-autocomplete > ul > completion-section {
      border: none !important;
      border-bottom: none !important;
    }
  `
  document.head.appendChild(style)

  return {
    destroy() {
      style.remove()
    },
  }
})

const theme = EditorView.theme({
  // Container
  ".cm-tooltip.cm-tooltip-autocomplete": {
    width: "260px",
    padding: "0",
    overflow: "hidden",
    borderRadius: "var(--border-radius-lg)",
    border: "none",
    boxShadow: "0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)",
  },

  // Scrollable list
  ".cm-tooltip.cm-tooltip-autocomplete > ul": {
    fontFamily: "var(--font-family-content)",
    color: "inherit",
    maxHeight: "45svh",
    overflow: "auto",
    scrollPadding: "4px",
    padding: "4px",
    maxWidth: "none",
    minWidth: "0",
  },

  // Items — DropdownMenu.Item
  ".cm-tooltip.cm-tooltip-autocomplete > ul > li": {
    display: "flex",
    height: "32px",
    cursor: "pointer",
    userSelect: "none",
    alignItems: "center",
    gap: "12px",
    borderRadius: "var(--border-radius-sm)",
    padding: "0 12px",
    overflow: "hidden",
    textOverflow: "ellipsis",
  },

  // Selected item
  ".cm-tooltip.cm-tooltip-autocomplete > ul > li[aria-selected]": {
    backgroundColor: "var(--color-bg-hover)",
    color: "var(--color-text)",
  },

  // Detail text
  ".cm-tooltip.cm-tooltip-autocomplete > ul > li .cm-completionDetail": {
    marginLeft: "auto",
    paddingLeft: "12px",
    fontSize: "var(--font-size-sm)",
    color: "var(--color-text-tertiary)",
    fontStyle: "normal",
  },

  // Section headers — <completion-section> custom element
  ".cm-tooltip.cm-tooltip-autocomplete > ul > completion-section": {
    display: "flex",
    alignItems: "center",
    height: "32px",
    padding: "0 12px",
    fontSize: "11px",
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: "0.05em",
    color: "var(--color-text-tertiary)",
    border: "none",
    borderBottom: "none",
    opacity: "1",
    listStyle: "none",
  },

  // Matched text
  ".cm-completionMatchedText": {
    textDecoration: "none",
  },

  // Icons
  ".cm-completionIcon": {
    padding: "0",
    marginRight: "0",
    width: "16px",
    height: "16px",
    opacity: "1",
  },

  ".cm-completionIcon::after": {
    display: "inline-block",
    width: "16px",
    height: "16px",
  },

  // Info panel
  ".cm-tooltip.cm-completionInfo": {
    backdropFilter: "blur(16px)",
    borderRadius: "var(--border-radius-lg)",
    padding: "8px 12px",
    fontSize: "var(--font-size-sm)",
    color: "inherit",
  },
})

export function autocompleteThemeExtension(): Extension {
  return [theme, backdropCSS]
}
