import { createFileRoute } from "@tanstack/react-router"
import { useAtomValue } from "jotai"
import { useState } from "react"
import { NoteIcon16 } from "../components/icons"
import { NoteList } from "../components/note-list"
import { PageLayout } from "../components/page-layout"
import { DashboardView } from "../components/dashboard-view"
import { shouldShowDashboardAtom } from "../global-state"

type RouteSearch = {
  query: string | undefined
  view: "grid" | "list"
}

export const Route = createFileRoute("/_appRoot/")({
  validateSearch: (search: Record<string, unknown>): RouteSearch => {
    return {
      query: typeof search.query === "string" ? search.query : undefined,
      view: search.view === "list" ? "list" : "grid",
    }
  },
  component: RouteComponent,
})

function RouteComponent() {
  const { query, view } = Route.useSearch()
  const navigate = Route.useNavigate()
  const shouldShowDashboard = useAtomValue(shouldShowDashboardAtom)
  const [forcedView, setForcedView] = useState<"dashboard" | "notes" | null>(null)

  const showDashboard = forcedView === "dashboard" || (forcedView === null && shouldShowDashboard)

  if (showDashboard) {
    return (
      <PageLayout title="Dashboard" icon={<NoteIcon16 />}>
        <DashboardView onShowNotes={() => setForcedView("notes")} />
      </PageLayout>
    )
  }

  return (
    <PageLayout title="Notes" icon={<NoteIcon16 />}>
      <div className="p-4 pt-0">
        {shouldShowDashboard && forcedView === "notes" ? (
          <button
            onClick={() => setForcedView("dashboard")}
            className="mb-3 w-full rounded-lg bg-bg-secondary px-3 py-2 text-left text-sm text-text-secondary hover:bg-bg-secondary-hover"
          >
            Tienes pendientes — ver dashboard →
          </button>
        ) : null}
        <NoteList
          query={query ?? ""}
          view={view}
          onQueryChange={(query) =>
            navigate({ search: (prev) => ({ ...prev, query }), replace: true })
          }
          onViewChange={(view) =>
            navigate({ search: (prev) => ({ ...prev, view }), replace: true })
          }
        />
      </div>
    </PageLayout>
  )
}
