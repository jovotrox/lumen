import { createFileRoute } from "@tanstack/react-router"
import { Inbox } from "lucide-react"
import { PageLayout } from "../components/page-layout"
import { InboxView } from "../components/inbox-view"

type RouteSearch = {
  query: string | undefined
}

export const Route = createFileRoute("/_appRoot/inbox")({
  validateSearch: (search: Record<string, unknown>): RouteSearch => {
    return {
      query: typeof search.query === "string" ? search.query : undefined,
    }
  },
  component: RouteComponent,
  head: () => ({
    meta: [{ title: "Inbox · Lumen" }],
  }),
})

function RouteComponent() {
  const { query } = Route.useSearch()
  const navigate = Route.useNavigate()

  return (
    <PageLayout title="Inbox" icon={<Inbox size={16} />}>
      <div className="p-4 pt-0">
        <InboxView
          query={query ?? ""}
          onQueryChange={(query) =>
            navigate({ search: (prev) => ({ ...prev, query }), replace: true })
          }
        />
      </div>
    </PageLayout>
  )
}
