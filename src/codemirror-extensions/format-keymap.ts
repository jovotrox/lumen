import { Prec } from "@codemirror/state"
import { keymap } from "@codemirror/view"
import {
  toggleBold,
  toggleItalic,
  toggleStrikethrough,
  toggleInlineCode,
  setHeading,
  toggleBlockquote,
  toggleBulletList,
  toggleNumberedList,
  toggleTaskList,
  insertLink,
} from "./format-commands"

export function formatKeymapExtension() {
  return Prec.low(
    keymap.of([
      { key: "Mod-b", run: toggleBold },
      { key: "Mod-i", run: toggleItalic },
      { key: "Mod-Shift-s", run: toggleStrikethrough },
      { key: "Mod-Shift-m", run: toggleInlineCode },
      {
        key: "Mod-Shift-h",
        run: (view) => {
          // Cycle heading: none → H1 → H2 → H3 → none
          const line = view.state.doc.lineAt(view.state.selection.main.from)
          const match = line.text.match(/^(#{1,6}) /)
          const currentLevel = match ? Math.min(match[1].length, 3) : 0
          const nextLevel = currentLevel >= 3 ? 0 : currentLevel + 1
          if (nextLevel === 0) {
            // Remove heading — setHeading with current level removes it
            return setHeading(view, currentLevel as 1 | 2 | 3)
          }
          return setHeading(view, nextLevel as 1 | 2 | 3)
        },
      },
      { key: "Mod-Shift-b", run: toggleBlockquote },
      { key: "Mod-Shift-l", run: toggleBulletList },
      { key: "Mod-Shift-o", run: toggleNumberedList },
      { key: "Mod-Shift-t", run: toggleTaskList },
      { key: "Mod-k", run: insertLink },
    ]),
  )
}
