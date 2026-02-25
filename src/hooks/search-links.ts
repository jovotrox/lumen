import { useAtomValue } from "jotai"
import React from "react"
import type { FullOptions, Searcher as FuzzySearcher } from "fast-fuzzy"
import { externalLinkSearcherAtom, externalLinksAtom } from "../global-state"
import { parseQuery } from "../utils/search"
import { filterLinks, sortLinks } from "../utils/search-links"
import type { LinkWithNote } from "../schema"

function runSearch(
  query: string,
  links: LinkWithNote[],
  linkSearcher: FuzzySearcher<LinkWithNote, FullOptions<LinkWithNote>>,
) {
  if (!query) return links
  const { fuzzy, filters, sorts } = parseQuery(query)
  const results = fuzzy ? linkSearcher.search(fuzzy) : links
  const filtered = filterLinks(results, filters)
  return sorts.length ? sortLinks(filtered, sorts) : filtered
}

export function useSearchLinks() {
  const links = useAtomValue(externalLinksAtom)
  const linkSearcher = useAtomValue(externalLinkSearcherAtom)

  const searchLinks = React.useCallback(
    (query: string) => {
      return runSearch(query, links, linkSearcher)
    },
    [links, linkSearcher],
  )

  return searchLinks
}
