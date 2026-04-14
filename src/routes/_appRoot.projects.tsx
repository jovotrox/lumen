import { createFileRoute } from "@tanstack/react-router"
import { FolderOpen } from "lucide-react"
import { PageLayout } from "../components/page-layout"
import { ProjectsView } from "../components/projects-view"

export type ViewMode = "sm" | "md" | "lg" | "list"

type RouteSearch = {
  query: string | undefined
  view: ViewMode
}

const validViews = new Set<ViewMode>(["sm", "md", "lg", "list"])

export const Route = createFileRoute("/_appRoot/projects")({
  validateSearch: (search: Record<string, unknown>): RouteSearch => {
    return {
      query: typeof search.query === "string" ? search.query : undefined,
      view: validViews.has(search.view as ViewMode) ? (search.view as ViewMode) : "list",
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
      <div className="flex flex-col p-4 pt-0 sm:px-8 sm:pt-2">
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
