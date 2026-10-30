import type { ParsedLink } from './types'

// A Map, not an object: `{}['constructor']` would return a function for `&constructor;`.
const NAMED_ENTITIES = new Map([
  ['amp', '&'],
  ['lt', '<'],
  ['gt', '>'],
  ['quot', '"'],
  ['apos', "'"],
  ['nbsp', ' '],
])

/** Decodes the HTML entities that matter for URLs and link text. Unknown ones are left as-is. */
export function decodeEntities(input: string): string {
  return input.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (match, entity: string) => {
    if (entity.startsWith('#')) {
      const isHex = entity[1].toLowerCase() === 'x'
      const code = isHex ? parseInt(entity.slice(2), 16) : parseInt(entity.slice(1), 10)
      return code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : match
    }
    return NAMED_ENTITIES.get(entity.toLowerCase()) ?? match
  })
}

// An <a ...> tag whose attributes may contain ">" inside quotes, up to the closing </a>.
const ANCHOR = /<a\b((?:"[^"]*"|'[^']*'|[^>"'])*)>([\s\S]*?)<\/a\s*>/gi
const HREF = /(?:^|\s)href\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>]+))/i
const PLAIN_URL = /\bhttps?:\/\/[^\s<>"']+/gi

function visibleText(innerHtml: string): string {
  return decodeEntities(innerHtml.replace(/<[^>]*>/g, ' '))
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * Finds links in an email body. Pure string work: nothing is rendered, opened or fetched.
 * HTML anchors keep both their visible text and real target; bare URLs in the plain-text
 * body are added only when the HTML did not already contain them.
 */
export function extractLinks(html: string, text: string): ParsedLink[] {
  const links: ParsedLink[] = []
  const seen = new Set<string>()

  for (const match of html.matchAll(ANCHOR)) {
    const href = HREF.exec(match[1])
    const rawHref = href ? (href[1] ?? href[2] ?? href[3]) : ''
    const target = decodeEntities(rawHref).trim()
    if (target === '' || target.startsWith('#')) continue

    const link: ParsedLink = { text: visibleText(match[2]), href: target, source: 'html' }
    const key = `${link.text}\u0000${link.href}`
    if (!seen.has(key)) {
      seen.add(key)
      links.push(link)
    }
  }

  const htmlTargets = new Set(links.map((link) => link.href))
  for (const match of text.matchAll(PLAIN_URL)) {
    const url = match[0].replace(/[.,;:!?)\]}]+$/, '')
    if (htmlTargets.has(url) || seen.has(`${url}\u0000${url}`)) continue
    seen.add(`${url}\u0000${url}`)
    links.push({ text: url, href: url, source: 'text' })
  }

  return links
}
