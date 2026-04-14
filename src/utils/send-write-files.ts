import { getDefaultStore } from "jotai"
import { globalStateMachineAtom } from "../global-state"

/**
 * Send a WRITE_FILES event to the state machine via the Jotai store.
 * This serializes git operations (add/commit) with pull/push, preventing
 * concurrent git operations that corrupt IndexedDB.
 *
 * Use this instead of calling gitAdd/gitCommit directly from non-React code.
 */
export function sendWriteFiles(files: Record<string, string | null>, commitMessage?: string): void {
  const store = getDefaultStore()
  store.set(globalStateMachineAtom, {
    type: "WRITE_FILES",
    markdownFiles: files,
    commitMessage,
  })
}
