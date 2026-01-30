import { useAtomValue } from "jotai"
import { sidebarAtom } from "../global-state"
import { cx } from "../utils/cx"
import { NavBar } from "./nav-bar"
import { Sidebar } from "./sidebar"
import { SignInBanner } from "./sign-in-banner"

type AppLayoutProps = {
  className?: string
  children?: React.ReactNode
}

export function AppLayout({ className, children }: AppLayoutProps) {
  const sidebar = useAtomValue(sidebarAtom)

  return (
    <div className={cx("flex grow flex-col overflow-hidden print:overflow-visible relative", className)}>
      {/* Titlebar drag region - only visible in Tauri */}
      <div
        // @ts-expect-error WebkitAppRegion is a non-standard CSS property for Tauri window dragging
        style={{ WebkitAppRegion: "drag", height: "var(--titlebar-height)" }}
        className="absolute top-0 left-0 right-0 z-50 pointer-events-auto"
      />

      <div style={{ paddingTop: "var(--titlebar-height)" }} className="flex grow flex-col overflow-hidden">
        <SignInBanner />
        <div className="flex overflow-hidden grow">
          {sidebar === "expanded" ? (
            <div className="hidden sm:grid print:hidden">
              <Sidebar />
            </div>
          ) : null}
          <div className="grid grow grid-rows-[1fr_auto] overflow-hidden">
            {children}
            <div className="sm:hidden print:hidden">
              <NavBar />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
