import { cx } from "../utils/cx"

/**
 * Placeholder block for loading states. Uses Tailwind's `animate-pulse` — a
 * 2s ease-in-out opacity loop. Subtler than a shimmer, more native-feeling.
 *
 * Use skeletons only for async waits that typically exceed ~200ms. For
 * faster loads, render nothing and let the content appear directly —
 * otherwise the skeleton flashes briefly and feels worse than just a jump.
 */
export function Skeleton({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      aria-hidden
      className={cx("animate-pulse rounded bg-bg-secondary", className)}
      {...props}
    />
  )
}

/** N stacked text lines; the last line is 2/3 width to mimic natural line wrap. */
export function SkeletonText({ lines = 3, className }: { lines?: number; className?: string }) {
  return (
    <div className={cx("space-y-2", className)}>
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton key={i} className={cx("h-3", i === lines - 1 ? "w-2/3" : "w-full")} />
      ))}
    </div>
  )
}

/** A row with a leading icon placeholder + text line — mimics list-item shape. */
export function SkeletonListItem({ className }: { className?: string }) {
  return (
    <div className={cx("flex items-center gap-3 px-2 py-1.5", className)}>
      <Skeleton className="size-5 shrink-0 rounded-md" />
      <Skeleton className="h-3 flex-1" />
    </div>
  )
}
