import { useAtomValue } from "jotai"
import { selectAtom } from "jotai/utils"
import { useEffect, useRef, useState } from "react"
import { useNetworkState } from "react-use"
import { globalStateMachineAtom, isRepoClonedAtom } from "../global-state"
import { cx } from "../utils/cx"
import { CheckFillIcon16, ErrorFillIcon16, LoadingFillIcon16 } from "./icons"

const isSyncingAtom = selectAtom(
  globalStateMachineAtom,
  (state) =>
    state.matches("signedIn.cloned.sync.pulling") ||
    state.matches("signedIn.cloned.sync.pushing") ||
    state.matches("signedIn.cloned.sync.checkingStatus"),
)

const isSyncErrorAtom = selectAtom(globalStateMachineAtom, (state) =>
  state.matches("signedIn.cloned.sync.error"),
)

type SyncState = "syncing" | "synced" | "error" | null

function useSyncState(): SyncState {
  const isSyncing = useAtomValue(isSyncingAtom)
  const isSyncError = useAtomValue(isSyncErrorAtom)
  const isRepoCloned = useAtomValue(isRepoClonedAtom)
  const { online } = useNetworkState()

  if (!isRepoCloned || !online) return null
  if (isSyncing) return "syncing"
  if (isSyncError) return "error"
  return "synced"
}

/**
 * Returns the sync status text and whether the indicator should be visible.
 * "Syncing" and "Synced" auto-hide after 3 seconds. Errors stay visible.
 */
export function useSyncStatus() {
  const state = useSyncState()
  const [visible, setVisible] = useState(false)
  const timerRef = useRef<ReturnType<typeof setTimeout>>()

  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current)

    if (state === "syncing") {
      setVisible(true)
    } else if (state === "synced") {
      setVisible(true)
      timerRef.current = setTimeout(() => setVisible(false), 3000)
    } else if (state === "error") {
      setVisible(true)
    } else {
      setVisible(false)
    }

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [state])

  const text =
    state === "syncing"
      ? "Syncing\u2026"
      : state === "error"
        ? "Sync error"
        : state === "synced"
          ? "Synced"
          : null

  return { state, text, visible }
}

export function SyncStatusIcon({ className, state }: { className?: string; state: SyncState }) {
  if (state === "syncing") {
    return <LoadingFillIcon16 className={cx("text-text-secondary", className)} />
  }

  if (state === "error") {
    return <ErrorFillIcon16 className={cx("text-text-danger", className)} />
  }

  if (state === "synced") {
    return <CheckFillIcon16 className={cx("text-text-success", className)} />
  }

  return null
}
