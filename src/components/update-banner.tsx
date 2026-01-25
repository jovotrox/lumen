import { useUpdateNotifier } from "../hooks/use-update-notifier"
import { Button } from "./button"
import { IconButton } from "./icon-button"
import { ClearIcon16 } from "./icons"

export function UpdateBanner() {
  const { updateAvailable, dismiss, refresh } = useUpdateNotifier()

  if (!updateAvailable) return null

  return (
    <div className="fixed bottom-4 right-4 z-50 flex items-center gap-3 rounded-lg border border-border-secondary bg-bg-inset p-3 shadow-lg">
      <p className="text-sm text-text-secondary">A new version is available</p>
      <Button variant="primary" size="small" onClick={refresh}>
        Refresh
      </Button>
      <IconButton aria-label="Dismiss" onClick={dismiss}>
        <ClearIcon16 />
      </IconButton>
    </div>
  )
}
