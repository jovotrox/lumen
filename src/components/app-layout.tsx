import { useAtom, useAtomValue } from "jotai"
import { useHotkeys } from "react-hotkeys-hook"
import { Group, Panel, Separator, useDefaultLayout } from "react-resizable-panels"
import { useMedia } from "react-use"
import { isHelpPanelOpenAtom, sidebarAtom } from "../global-state"
import { cx } from "../utils/cx"
import { HelpDrawer, HelpSidebar } from "./help-panel"
import { NavBar } from "./nav-bar"
import { Sidebar } from "./sidebar"
import { SignInBanner } from "./sign-in-banner"
import { TabBar } from "./tab-bar"
import { Titlebar } from "./titlebar"

type AppLayoutProps = {
  className?: string
  children?: React.ReactNode
}

export function AppLayout({ className, children }: AppLayoutProps) {
  const sidebar = useAtomValue(sidebarAtom)
  const [isHelpPanelOpen, setHelpPanel] = useAtom(isHelpPanelOpenAtom)
  const isWideViewport = useMedia("(min-width: 1024px)")
  const showHelpSidebar = isHelpPanelOpen && isWideViewport
  const { defaultLayout, onLayoutChanged } = useDefaultLayout({
    id: "app-layout",
    panelIds: showHelpSidebar ? ["content", "help"] : ["content"],
    storage: window.localStorage,
  })

  // Toggle help panel with Cmd/Ctrl + /
  useHotkeys(
    "mod+/",
    () => {
      setHelpPanel((prev) => !prev)
    },
    {
      preventDefault: true,
      enableOnFormTags: true,
      enableOnContentEditable: true,
    },
  )

  return (
    <div className={cx("flex grow overflow-hidden print:overflow-visible", className)}>
      {/* Sidebar — full height, shown at sm+ when expanded */}
      {sidebar === "expanded" ? (
        <div className="hidden w-56 shrink-0 sm:grid print:hidden">
          <Sidebar />
        </div>
      ) : null}
      {/* Content column */}
      <div className="flex grow flex-col overflow-hidden">
        <Titlebar />
        <div className="flex grow overflow-hidden">
          <Group
            orientation="horizontal"
            className="grow overflow-hidden"
            defaultLayout={defaultLayout}
            onLayoutChanged={onLayoutChanged}
          >
            <Panel id="content" className="grid grid-rows-[auto_1fr_auto] overflow-hidden">
              <TabBar />
              <div className="row-start-2 min-h-0 overflow-hidden">{children}</div>
              <div className="row-start-3 sm:hidden print:hidden">
                <NavBar />
              </div>
            </Panel>
            {showHelpSidebar ? (
              <>
                <Separator className="relative w-px bg-border-secondary print:hidden outline-none">
                  <div className="absolute inset-y-0 -left-1.5 -right-1.5 z-10" />
                </Separator>
                <Panel
                  id="help"
                  className="print:hidden"
                  defaultSize="30%"
                  minSize="25%"
                  maxSize="40%"
                >
                  <HelpSidebar />
                </Panel>
              </>
            ) : null}
          </Group>
          {!isWideViewport ? <HelpDrawer /> : null}
        </div>
        <SignInBanner className="hidden sm:flex border-t border-border-secondary" />
      </div>
    </div>
  )
}
