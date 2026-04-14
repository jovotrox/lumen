import { Link, useNavigate } from "@tanstack/react-router"
import { TrailSegment } from "../global-state"
import { cx } from "../utils/cx"
import { BreadcrumbIcon } from "./breadcrumb-icon"
import { DropdownMenu } from "./dropdown-menu"

type Props = {
  trail: TrailSegment[]
  className?: string
}

/** How many trailing segments to always show when the trail is collapsed. */
const KEEP_TAIL = 3
/** Trail length above which the middle is collapsed behind a "…" dropdown. */
const COLLAPSE_AFTER = 5

/**
 * Notion-style breadcrumb: icon + label per segment, `/` separators,
 * current segment bolded and non-clickable. Renders `null` when the trail
 * is empty (blacklisted route, no tabs, pre-feature persisted tab).
 */
export function Breadcrumb({ trail, className }: Props) {
  if (trail.length === 0) return null

  // When the trail is longer than COLLAPSE_AFTER, render as:
  //   [head (first)]  /  …  /  [tail (last KEEP_TAIL)]
  // Otherwise render every segment with separators.
  const shouldCollapse = trail.length > COLLAPSE_AFTER
  const head = shouldCollapse ? trail.slice(0, 1) : []
  const hiddenMiddle = shouldCollapse ? trail.slice(1, trail.length - KEEP_TAIL) : []
  const tail = shouldCollapse ? trail.slice(-KEEP_TAIL) : trail

  return (
    <nav
      aria-label="Breadcrumb"
      className={cx("flex min-w-0 select-none items-center gap-0 overflow-hidden", className)}
    >
      {head.map((seg) => (
        <SegmentRow key={seg.path} segment={seg} withSeparator />
      ))}
      {shouldCollapse ? (
        <>
          <EllipsisDropdown segments={hiddenMiddle} />
          <Separator />
        </>
      ) : null}
      {tail.map((seg, i) => {
        const isLast = i === tail.length - 1
        return (
          <SegmentRow
            key={`${seg.path}-${i}`}
            segment={seg}
            isLast={isLast}
            withSeparator={!isLast}
          />
        )
      })}
    </nav>
  )
}

function SegmentRow({
  segment,
  isLast = false,
  withSeparator = true,
}: {
  segment: TrailSegment
  isLast?: boolean
  withSeparator?: boolean
}) {
  return (
    <>
      {isLast ? (
        <span
          className="flex min-w-0 items-center gap-1.5 rounded px-1.5 py-0.5 font-medium text-text"
          aria-current="page"
        >
          <span className="flex shrink-0 text-text-secondary">
            <BreadcrumbIcon segment={segment} />
          </span>
          <span className="max-w-[180px] truncate">{segment.title}</span>
        </span>
      ) : (
        <Link
          to={segment.path}
          draggable={false}
          className="flex min-w-0 items-center gap-1.5 rounded px-1.5 py-0.5 text-text-secondary transition-colors hover:bg-bg-hover hover:text-text"
        >
          <span className="flex shrink-0 text-text-secondary">
            <BreadcrumbIcon segment={segment} />
          </span>
          <span className="max-w-[180px] truncate">{segment.title}</span>
        </Link>
      )}
      {withSeparator ? <Separator /> : null}
    </>
  )
}

function Separator() {
  return <span className="mx-0.5 shrink-0 text-text-tertiary">/</span>
}

function EllipsisDropdown({ segments }: { segments: TrailSegment[] }) {
  const navigate = useNavigate()
  if (segments.length === 0) return null
  const trigger = (
    <button
      type="button"
      aria-label={`Show ${segments.length} hidden breadcrumb segments`}
      className="flex shrink-0 items-center rounded px-1.5 py-0.5 text-text-secondary transition-colors hover:bg-bg-hover hover:text-text"
    >
      …
    </button>
  )
  return (
    <DropdownMenu>
      <DropdownMenu.Trigger render={trigger} />
      <DropdownMenu.Content align="start" sideOffset={4} width={220}>
        {segments.map((seg, i) => (
          <DropdownMenu.Item
            key={`${seg.path}-hidden-${i}`}
            icon={<BreadcrumbIcon segment={seg} />}
            onClick={() => navigate({ to: seg.path })}
          >
            {seg.title}
          </DropdownMenu.Item>
        ))}
      </DropdownMenu.Content>
    </DropdownMenu>
  )
}
