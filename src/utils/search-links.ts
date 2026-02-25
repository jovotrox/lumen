import type { LinkWithNote } from "../schema"
import type { Filter, Sort } from "./search"

export function getDomain(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "")
  } catch {
    return url
  }
}

export function filterLinks(links: LinkWithNote[], filters: Filter[]): LinkWithNote[] {
  return links.filter((link) => testLinkFilters(filters, link))
}

export function testLinkFilters(filters: Filter[], link: LinkWithNote): boolean {
  return filters.every((filter) => testLinkFilter(filter, link))
}

export function testLinkFilter(filter: Filter, link: LinkWithNote): boolean {
  let value = false

  switch (filter.key) {
    case "domain":
      value = filter.values.some((v) => getDomain(link.url) === v)
      break
    case "note":
      value = filter.values.includes(link.note.id)
      break
    case "type":
      value = filter.values.includes(link.note.type)
      break
    default:
      break
  }

  return filter.exclude ? !value : value
}

export function sortLinks(links: LinkWithNote[], sorts: Sort[]): LinkWithNote[] {
  return [...links].sort((a, b) => compareLinks(a, b, sorts))
}

const collator = new Intl.Collator(undefined, {
  sensitivity: "base",
  numeric: true,
  ignorePunctuation: true,
})

function compareLinks(a: LinkWithNote, b: LinkWithNote, sorts: Sort[]): number {
  for (const sort of sorts) {
    let result = 0

    switch (sort.key) {
      case "domain":
        result = collator.compare(getDomain(a.url), getDomain(b.url))
        break
      case "url":
        result = collator.compare(a.url, b.url)
        break
      case "text":
        result = collator.compare(a.text, b.text)
        break
      case "note":
        result = collator.compare(a.note.id, b.note.id)
        break
      default:
        continue
    }

    if (result !== 0) {
      return sort.direction === "desc" ? -result : result
    }
  }

  return 0
}
