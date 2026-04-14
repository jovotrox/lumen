import { Link } from "@tanstack/react-router"
import React, { useMemo, useState } from "react"
import { useInView } from "react-intersection-observer"
import { useDebounce } from "use-debounce"
import { useSearchLinks } from "../hooks/search-links"
import { useNoteById } from "../hooks/note"
import { LinkWithNote, Note } from "../schema"
import { parseQuery } from "../utils/search"
import { getDomain } from "../utils/search-links"
import { formatNumber, pluralize } from "../utils/pluralize"
import { Button } from "./button"
import { DropdownMenu } from "./dropdown-menu"

import { ChevronDown, Grid3x3, List } from "lucide-react"
import { GlobeIcon16, PinFillIcon12, XIcon12 } from "./icons"
import { LinkHighlightProvider } from "./link-highlight-provider"
import { NoteFavicon } from "./note-favicon"
import { NoteLink } from "./note-link"
import { NotePreviewCard } from "./note-preview-card"
import { PillButton } from "./pill-button"
import { SearchInput } from "./search-input"
import { WebsiteFavicon } from "./website-favicon"

type View = "grid" | "list"

type LinksViewProps = {
  query: string
  view: View
  onQueryChange: (query: string) => void
  onViewChange: (view: View) => void
}

const initialVisibleLinks = 20
const initialVisibleNotes = 6

export function LinksView({ query, view, onQueryChange, onViewChange }: LinksViewProps) {
  const searchLinks = useSearchLinks()

  const [deferredQuery] = useDebounce(query, 150)

  const linkResults = useMemo(() => {
    return searchLinks(deferredQuery)
  }, [searchLinks, deferredQuery])

  // Derive unique notes from link results
  const notesWithLinks = useMemo(() => {
    const noteMap = new Map<string, Note>()
    for (const link of linkResults) {
      if (!noteMap.has(link.note.id)) {
        noteMap.set(link.note.id, link.note)
      }
    }
    return [...noteMap.values()]
  }, [linkResults])

  // Deduplicate links by URL
  const uniqueLinkResults = useMemo(() => {
    const seen = new Set<string>()
    return linkResults.filter((link) => {
      if (seen.has(link.url)) return false
      seen.add(link.url)
      return true
    })
  }, [linkResults])

  const [numVisibleLinks, setNumVisibleLinks] = useState(initialVisibleLinks)
  const [numVisibleNotes, setNumVisibleNotes] = useState(initialVisibleNotes)

  const [linksBottomRef, linksBottomInView] = useInView()
  const [notesBottomRef, notesBottomInView] = useInView()

  const loadMoreLinks = React.useCallback(() => {
    setNumVisibleLinks((num) => Math.min(num + 20, uniqueLinkResults.length))
  }, [uniqueLinkResults.length])

  const loadMoreNotes = React.useCallback(() => {
    setNumVisibleNotes((num) => Math.min(num + 6, notesWithLinks.length))
  }, [notesWithLinks.length])

  React.useEffect(() => {
    if (linksBottomInView) {
      loadMoreLinks()
    }
  }, [linksBottomInView, loadMoreLinks])

  React.useEffect(() => {
    if (notesBottomInView) {
      loadMoreNotes()
    }
  }, [notesBottomInView, loadMoreNotes])

  // Reset visible counts when query changes
  React.useEffect(() => {
    setNumVisibleLinks(initialVisibleLinks)
    setNumVisibleNotes(initialVisibleNotes)
  }, [deferredQuery])

  const numVisibleDomains = 4

  const sortedDomainFrequencies = React.useMemo(() => {
    const frequencyMap = new Map<string, number>()

    for (const link of uniqueLinkResults) {
      const domain = getDomain(link.url)
      frequencyMap.set(domain, (frequencyMap.get(domain) ?? 0) + 1)
    }

    const frequencyEntries = [...frequencyMap.entries()]

    return frequencyEntries
      .filter(([, frequency]) => frequency < uniqueLinkResults.length)
      .sort((a, b) => b[1] - a[1])
  }, [uniqueLinkResults])

  const filters = React.useMemo(() => {
    return parseQuery(query).filters
  }, [query])

  const domainFilters = React.useMemo(() => {
    return filters.filter((filter) => filter.key === "domain")
  }, [filters])

  const highlightPaths = React.useMemo(() => {
    return filters
      .filter((filter) => !filter.exclude)
      .flatMap((filter) => {
        switch (filter.key) {
          case "note":
            return filter.values.map((value) => `/${value}`)
          default:
            return []
        }
      })
  }, [filters])

  return (
    <LinkHighlightProvider href={highlightPaths}>
      <div className="flex flex-col gap-6">
        {/* Search and filters */}
        <div className="flex flex-col gap-4">
          <div className="flex gap-2">
            <SearchInput
              placeholder={`Search ${pluralize(uniqueLinkResults.length, "link")}…`}
              value={query}
              autoCapitalize="off"
              spellCheck="false"
              onChange={(value) => {
                onQueryChange(value)
                setNumVisibleLinks(initialVisibleLinks)
                setNumVisibleNotes(initialVisibleNotes)
              }}
            />
          </div>
          {sortedDomainFrequencies.length > 0 || domainFilters.length > 0 || deferredQuery ? (
            <div className="flex flex-col gap-3">
              <div className="flex flex-wrap gap-2 empty:hidden">
                {sortedDomainFrequencies.length > 0 || domainFilters.length > 0 ? (
                  <>
                    {domainFilters.map((filter) => (
                      <PillButton
                        key={filter.values.join(",")}
                        data-domain={filter.values.join(",")}
                        variant="primary"
                        onClick={() => {
                          const text = `${filter.exclude ? "-" : ""}domain:${filter.values.join(",")}`
                          const index = query.indexOf(text)
                          if (index === -1) return
                          const newQuery =
                            query.slice(0, index) + query.slice(index + text.length).trimStart()
                          onQueryChange(newQuery.trim())
                        }}
                      >
                        <GlobeIcon16 className="-ml-0.5 size-3" />
                        {filter.exclude ? <span className="italic">not</span> : null}
                        {filter.values.map((value, index) => (
                          <React.Fragment key={value}>
                            {index > 0 ? <span>or</span> : null}
                            <span>{value}</span>
                          </React.Fragment>
                        ))}
                        <XIcon12 className="-mr-0.5" />
                      </PillButton>
                    ))}
                    {sortedDomainFrequencies
                      .slice(0, numVisibleDomains)
                      .map(([domain, frequency]) => (
                        <PillButton
                          key={domain}
                          data-domain={domain}
                          onClick={(event) => {
                            const qualifier = `${event.shiftKey ? "-" : ""}domain:${domain}`
                            onQueryChange(query ? `${query} ${qualifier}` : qualifier)
                            setTimeout(() => {
                              document
                                .querySelector<HTMLElement>(`[data-domain="${domain}"]`)
                                ?.focus()
                            })
                          }}
                        >
                          <GlobeIcon16 className="text-text-secondary size-3" />
                          {domain}
                          <span className="text-text-secondary">{formatNumber(frequency)}</span>
                        </PillButton>
                      ))}
                    {sortedDomainFrequencies.length > numVisibleDomains ? (
                      <DropdownMenu>
                        <DropdownMenu.Trigger
                          render={
                            <PillButton variant="dashed" className="data-[popup-open]:bg-bg-hover">
                              Show more
                            </PillButton>
                          }
                        />
                        <DropdownMenu.Content width={300}>
                          {sortedDomainFrequencies
                            .slice(numVisibleDomains)
                            .map(([domain, frequency]) => (
                              <DropdownMenu.Item
                                key={domain}
                                icon={<GlobeIcon16 />}
                                trailingVisual={
                                  <span className="text-text-secondary epaper:text-current">
                                    {frequency}
                                  </span>
                                }
                                onClick={(event) => {
                                  const qualifier = `${event.shiftKey ? "-" : ""}domain:${domain}`
                                  onQueryChange(query ? `${query} ${qualifier}` : qualifier)
                                }}
                              >
                                {domain}
                              </DropdownMenu.Item>
                            ))}
                        </DropdownMenu.Content>
                      </DropdownMenu>
                    ) : null}
                  </>
                ) : null}
              </div>
              {deferredQuery ? (
                <div className="text-sm text-text-secondary leading-4">
                  {pluralize(uniqueLinkResults.length, "result")}
                </div>
              ) : null}
            </div>
          ) : null}
        </div>

        {/* Links section */}
        <div className="flex flex-col gap-3">
          <h2 className="text-sm font-medium text-text-secondary">
            Links ({formatNumber(uniqueLinkResults.length)})
          </h2>
          <ul className="flex flex-col gap-0.5">
            {uniqueLinkResults.slice(0, numVisibleLinks).map((link) => (
              <LinkListItem key={`${link.note.id}-${link.url}`} link={link} />
            ))}
          </ul>
          {uniqueLinkResults.length > numVisibleLinks ? (
            <Button ref={linksBottomRef} className="w-full" onClick={loadMoreLinks}>
              Load more links
            </Button>
          ) : null}
        </div>

        {/* Notes section — collapsible */}
        {notesWithLinks.length > 0 ? (
          <CollapsibleNotesSection
            notes={notesWithLinks}
            view={view}
            onViewChange={onViewChange}
            numVisible={numVisibleNotes}
            total={notesWithLinks.length}
            loadMoreRef={notesBottomRef}
            onLoadMore={loadMoreNotes}
          />
        ) : null}
      </div>
    </LinkHighlightProvider>
  )
}

function LinkListItem({ link }: { link: LinkWithNote }) {
  const note = useNoteById(link.note.id)
  const noteLabel = note?.displayName ?? link.note.id

  return (
    <li>
      <div className="rounded-lg @container hover:bg-bg-hover">
        <div className="grid @md:grid-cols-[1fr_auto] @md:items-start">
          <div className="flex h-10 items-center gap-3 px-3 min-w-0 coarse:h-12 coarse:px-4">
            <WebsiteFavicon url={link.url} size={16} className="shrink-0" />
            <a
              href={link.url}
              target="_blank"
              rel="noopener noreferrer"
              className="focus-ring link-external min-w-0 truncate rounded-sm"
            >
              <span className="truncate">{link.text}</span>
            </a>
            <span className="hidden shrink-0 text-sm text-text-secondary sm:inline">
              {getDomain(link.url)}
            </span>
          </div>
          <div className="@md:h-10 flex h-6 items-center truncate text-text-secondary px-1.5 coarse:@md:h-12">
            <NoteLink
              id={link.note.id}
              text={noteLabel}
              className="link truncate @md:max-w-52"
              hoverCardAlign="end"
            />
          </div>
        </div>
      </div>
    </li>
  )
}

function CollapsibleNotesSection({
  notes,
  view,
  onViewChange,
  numVisible,
  total,
  loadMoreRef,
  onLoadMore,
}: {
  notes: Note[]
  view: View
  onViewChange: (v: View) => void
  numVisible: number
  total: number
  loadMoreRef: React.Ref<HTMLButtonElement>
  onLoadMore: () => void
}) {
  const [collapsed, setCollapsed] = useState(false)

  return (
    <div className="flex flex-col">
      <div className="flex h-8 items-center justify-between">
        <button
          className="flex items-center gap-1.5 text-sm font-medium text-text-secondary hover:text-text"
          onClick={() => setCollapsed((c) => !c)}
        >
          <ChevronDown
            size={14}
            className={`transition-transform ${collapsed ? "-rotate-90" : ""}`}
          />
          Notes ({formatNumber(total)})
        </button>
        {!collapsed ? (
          <DropdownMenu>
            <DropdownMenu.Trigger
              render={
                <button className="flex items-center gap-1 rounded px-1.5 py-0.5 text-xs text-text-tertiary transition-colors hover:bg-bg-hover hover:text-text-secondary">
                  {view === "grid" ? <Grid3x3 size={12} /> : <List size={12} />}
                  {view === "grid" ? "Grid" : "List"}
                </button>
              }
            />
            <DropdownMenu.Content align="end" width={120}>
              <DropdownMenu.Item
                icon={<Grid3x3 size={16} />}
                selected={view === "grid"}
                onClick={() => onViewChange("grid")}
              >
                Grid
              </DropdownMenu.Item>
              <DropdownMenu.Item
                icon={<List size={16} />}
                selected={view === "list"}
                onClick={() => onViewChange("list")}
              >
                List
              </DropdownMenu.Item>
            </DropdownMenu.Content>
          </DropdownMenu>
        ) : null}
      </div>
      {!collapsed ? (
        <div className="flex flex-col gap-3 pt-3">
          {view === "grid" ? (
            <div className="grid grid-cols-[repeat(auto-fill,minmax(200px,1fr))] gap-4">
              {notes.slice(0, numVisible).map((note) => (
                <NotePreviewCard key={note.id} id={note.id} />
              ))}
            </div>
          ) : (
            <ul className="flex flex-col gap-0.5">
              {notes.slice(0, numVisible).map((note) => (
                <li key={note.id}>
                  <Link
                    to="/notes/$"
                    params={{ _splat: note.id }}
                    search={{ mode: "read", query: undefined, view: "grid" }}
                    className="focus-ring flex h-10 items-center rounded-lg px-3 hover:bg-bg-hover coarse:h-12 coarse:p-4"
                  >
                    <NoteFavicon note={note} className="mr-3 coarse:mr-4" />
                    {note.pinned ? (
                      <PinFillIcon12 className="mr-2 coarse:mr-3 shrink-0 text-text-pinned" />
                    ) : null}
                    {note?.frontmatter?.gist_id ? (
                      <GlobeIcon16 className="mr-2 coarse:mr-3 shrink-0 text-border-focus" />
                    ) : null}
                    <span className="truncate text-text-secondary">
                      <span className="text-text">{note.displayName}</span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
          {total > numVisible ? (
            <Button ref={loadMoreRef} className="w-full" onClick={onLoadMore}>
              Load more notes
            </Button>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}
