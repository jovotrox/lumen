import { createFileRoute } from "@tanstack/react-router"
import { FolderOpen } from "lucide-react"
import { PageLayout } from "../components/page-layout"

type RouteSearch = {
  query: string | undefined
  view: "grid" | "list"
}

export const Route = createFileRoute("/_appRoot/projects")({
  validateSearch: (search: Record<string, unknown>): RouteSearch => {
    return {
      query: typeof search.query === "string" ? search.query : undefined,
      view: search.view === "list" ? "list" : "grid",
    }
  },
  component: RouteComponent,
})

function RouteComponent() {
  return (
    <PageLayout title="Projects" icon={<FolderOpen size={16} />}>
      <div className="p-4 pt-0">
        <p className="text-text-secondary">Projects coming soon.</p>
      </div>
    </PageLayout>
  )
}
