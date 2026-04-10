import { createFileRoute } from "@tanstack/react-router"
import { FolderOpen } from "lucide-react"
import { PageLayout } from "../components/page-layout"
import { ProjectsView } from "../components/projects-view"

type RouteSearch = {
  query: string | undefined
  view: "grid" | "list"
}

export const Route = createFileRoute("/_appRoot/projects")({
  validateSearch: (search: Record<string, unknown>): RouteSearch => {
    return {
      query: typeof search.query === "string" ? search.query : undefined,
      view: search.view === "grid" ? "grid" : "list",
    }
  },
  component: RouteComponent,
  head: () => ({
    meta: [{ title: "Projects · Lumen" }],
  }),
})

function RouteComponent() {
  const { query, view } = Route.useSearch()
  const navigate = Route.useNavigate()

  return (
    <PageLayout title="Projects" icon={<FolderOpen size={16} />}>
      <div className="p-4 pt-0">
        <ProjectsView
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
