import { Extension } from "@codemirror/state"
import { EditorView } from "@codemirror/view"

/**
 * Autocomplete dropdown theme — matches DropdownMenu component exactly.
 *
 * Uses EditorView.theme() instead of CSS to guarantee correct specificity
 * over CM's built-in baseTheme (which sets backgroundColor: #333338 on dark).
 *
 * CM uses <completion-section> custom HTML elements for section headers.
 */
export function autocompleteThemeExtension(): Extension {
  return EditorView.theme({
    // Container — DropdownMenu.Content: card-2 semi-transparent + blur
    ".cm-tooltip.cm-tooltip-autocomplete": {
      width: "260px",
      padding: "0",
      overflow: "hidden",
      borderRadius: "var(--border-radius-lg)",
      border: "none",
      backgroundColor: "var(--color-bg-overlay-backdrop)",
      backdropFilter: "blur(16px)",
      WebkitBackdropFilter: "blur(16px)",
      boxShadow: "0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)",
    },

    // Scrollable list — DropdownMenu inner container
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

    // Items — DropdownMenu.Item: h-8 gap-3 px-3 rounded
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

    // Selected item — DropdownMenu focus state
    ".cm-tooltip.cm-tooltip-autocomplete > ul > li[aria-selected]": {
      backgroundColor: "var(--color-bg-hover)",
      color: "var(--color-text)",
    },

    // Detail text — trailing secondary text
    ".cm-tooltip.cm-tooltip-autocomplete > ul > li .cm-completionDetail": {
      marginLeft: "auto",
      paddingLeft: "12px",
      fontSize: "var(--font-size-sm)",
      color: "var(--color-text-tertiary)",
      fontStyle: "normal",
    },

    // Section headers — <completion-section> custom element
    // DropdownMenu.GroupLabel: uppercase, small, tertiary, NO border
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

    // Matched text highlight
    ".cm-completionMatchedText": {
      textDecoration: "none",
    },

    // Icons — 16px, no extra margin (gap handles spacing)
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

    // Completion info panel
    ".cm-tooltip.cm-completionInfo": {
      backgroundColor: "var(--color-bg-overlay-backdrop)",
      backdropFilter: "blur(16px)",
      borderRadius: "var(--border-radius-lg)",
      padding: "8px 12px",
      fontSize: "var(--font-size-sm)",
      color: "inherit",
    },
  })
}
