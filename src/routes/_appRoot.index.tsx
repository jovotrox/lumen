import { createFileRoute } from "@tanstack/react-router"
import { DashboardView } from "../components/dashboard-view"
import { PageLayout } from "../components/page-layout"

export const Route = createFileRoute("/_appRoot/")({
  component: RouteComponent,
})

function RouteComponent() {
  return (
    <PageLayout title="">
      <DashboardView />
    </PageLayout>
  )
}
