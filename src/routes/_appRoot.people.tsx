import { createFileRoute } from "@tanstack/react-router"
import { User } from "lucide-react"
import { PageLayout } from "../components/page-layout"

type RouteSearch = {
  query: string | undefined
  view: "grid" | "list"
}

export const Route = createFileRoute("/_appRoot/people")({
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
    <PageLayout title="People" icon={<User size={16} />}>
      <div className="p-4 pt-0">
        <p className="text-text-secondary">People coming soon.</p>
      </div>
    </PageLayout>
  )
}
