import React from "react"
import { DEBUG_LOG_EVENT, clearDebugLog, formatDebugLog } from "../utils/debug-log"
import { Button } from "./button"

export function DebugLogPanel() {
  const [log, setLog] = React.useState(() => formatDebugLog())
  const [copyLabel, setCopyLabel] = React.useState<"Copy" | "Copied!" | "Copy failed">("Copy")

  React.useEffect(() => {
    const handler = () => setLog(formatDebugLog())
    window.addEventListener(DEBUG_LOG_EVENT, handler)
    return () => window.removeEventListener(DEBUG_LOG_EVENT, handler)
  }, [])

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(log)
      setCopyLabel("Copied!")
    } catch {
      setCopyLabel("Copy failed")
    }
    window.setTimeout(() => setCopyLabel("Copy"), 1500)
  }

  const handleClear = () => {
    if (!window.confirm("Clear debug log?")) return
    clearDebugLog()
    setLog(formatDebugLog())
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex gap-2">
        <Button onClick={handleCopy}>{copyLabel}</Button>
        <Button onClick={handleClear}>Clear</Button>
      </div>
      <pre className="max-h-64 overflow-auto rounded-sm bg-bg-secondary p-3 text-xs leading-relaxed text-text-secondary whitespace-pre-wrap break-words">
        {log}
      </pre>
    </div>
  )
}
