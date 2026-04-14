import { createFileRoute } from "@tanstack/react-router"
import { User } from "lucide-react"
import { PageLayout } from "../components/page-layout"
import { PeopleView } from "../components/people-view"
import type { ViewMode } from "./_appRoot.projects"

type RouteSearch = {
  query: string | undefined
  view: ViewMode
}

const validViews = new Set<ViewMode>(["sm", "md", "lg", "list"])

export const Route = createFileRoute("/_appRoot/people")({
  validateSearch: (search: Record<string, unknown>): RouteSearch => {
    return {
      query: typeof search.query === "string" ? search.query : undefined,
      view: validViews.has(search.view as ViewMode) ? (search.view as ViewMode) : "list",
    }
  },
  component: RouteComponent,
  head: () => ({
    meta: [{ title: "People · Lumen" }],
  }),
})

function RouteComponent() {
  const { query, view } = Route.useSearch()
  const navigate = Route.useNavigate()

  return (
    <PageLayout title="People" icon={<User size={16} />}>
      <div className="flex flex-col p-4 pt-0 sm:px-8 sm:pt-2">
        <PeopleView
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
