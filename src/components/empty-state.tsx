import { Link } from "@tanstack/react-router"
import { cx } from "../utils/cx"
import { Button } from "./button"

type EmptyStateAction =
  | { label: string; onClick: () => void; to?: never }
  | { label: string; to: string; onClick?: never }

export type EmptyStateProps = {
  /** Optional Lucide (or any) icon, rendered at 24-32px. Use `text-text-tertiary` for subtle tone. */
  icon?: React.ReactNode
  /** Short headline, 2–5 words. */
  title: string
  /** One-line sub-headline, optional. */
  description?: string
  /** Optional CTA — either an onClick handler or a TanStack Router `to` path. */
  action?: EmptyStateAction
  className?: string
}

/**
 * Centered, vertically balanced empty state — for canvas views with no data.
 * Matches the native-app pattern (Notion, Linear): icon + title + subtitle + CTA,
 * centered in a `min-h-[240px]` flex container.
 *
 * Not for inline-list empties (e.g., "0 pinned in sidebar") — use a subtle inline
 * hint there instead. This component is for full views/panels.
 */
export function EmptyState({ icon, title, description, action, className }: EmptyStateProps) {
  return (
    <div
      className={cx(
        "flex flex-1 min-h-[240px] select-none flex-col items-center justify-center gap-3 px-6 py-12 text-center",
        className,
      )}
    >
      {icon ? <div className="text-text-tertiary">{icon}</div> : null}
      <div className="space-y-1">
        <div className="text-base font-semibold text-text">{title}</div>
        {description ? <div className="text-sm text-text-secondary">{description}</div> : null}
      </div>
      {action ? (
        action.to ? (
          <Link to={action.to}>
            <Button variant="secondary" size="small">
              {action.label}
            </Button>
          </Link>
        ) : (
          <Button variant="secondary" size="small" onClick={action.onClick}>
            {action.label}
          </Button>
        )
      ) : null}
    </div>
  )
}
