import { registrableDomain, isSameOrganization } from '../domains'
import type { Flag, Localized } from '../flags'
import type { ParsedEmail, ParsedLink } from '../types'
import { findBrandImpersonation, hasRiskyEnding } from './domain'

/** Services that hide the real destination behind a short code. */
const SHORTENERS = new Set([
  'bit.ly',
  'tinyurl.com',
  't.co',
  'goo.gl',
  'ow.ly',
  'is.gd',
  'buff.ly',
  'rebrand.ly',
  'cutt.ly',
  'shorturl.at',
  'tiny.cc',
  'rb.gy',
  'short.test', // fictional shortener used by our fixtures
])

const SCRIPT_SCHEMES = new Set(['javascript:', 'vbscript:', 'data:'])

// Text that reads like a web address ("bank.com/login"), as opposed to words like "Click here".
const ADDRESS_LIKE =
  /^(?:[a-z][a-z0-9+.-]*:\/\/)?[a-z0-9-]+(?:\.[a-z0-9-]+)+(?::\d+)?(?:[/?#]\S*)?$/i
const FILE_EXTENSIONS = new Set([
  'pdf',
  'doc',
  'docx',
  'xls',
  'xlsx',
  'ppt',
  'pptx',
  'png',
  'jpg',
  'jpeg',
  'gif',
  'txt',
  'csv',
])

interface WebLink {
  link: ParsedLink
  url: URL
  /** Lowercase host without port or trailing dot. IPv6 stays in brackets. */
  host: string
}

function tryParseUrl(value: string): URL | null {
  try {
    return new URL(value.startsWith('//') ? `https:${value}` : value)
  } catch {
    return null // relative links, junk: nothing we can judge
  }
}

function isIpHost(host: string): boolean {
  return /^\d{1,3}(?:\.\d{1,3}){3}$/.test(host) || host.startsWith('[')
}

/** The host a link's visible text claims, or null when the text is not an address. */
function shownHost(text: string): string | null {
  if (!ADDRESS_LIKE.test(text)) return null
  const lastLabel =
    text
      .split(/[/?#:]/)[0]
      .split('.')
      .pop()
      ?.toLowerCase() ?? ''
  if (FILE_EXTENSIONS.has(lastLabel)) return null
  const url = tryParseUrl(/^[a-z][a-z0-9+.-]*:\/\//i.test(text) ? text : `https://${text}`)
  return url ? url.hostname.toLowerCase().replace(/\.$/, '') : null
}

/** "a, b, c and 2 more" in both languages, so one flag can name the offenders. */
function listOf(items: Iterable<string>, max = 3): Localized {
  const unique = [...new Set(items)]
  const shown = unique.slice(0, max).join(', ')
  const extra = unique.length - max
  return {
    en: extra > 0 ? `${shown} and ${extra} more` : shown,
    es: extra > 0 ? `${shown} y ${extra} más` : shown,
  }
}

/**
 * Checks where the links in the email really lead. Only the URL text is inspected: nothing
 * is opened, fetched or rendered. Each kind of problem raises one flag, naming up to three
 * examples, so a long email cannot pile up points just by repeating the same trick.
 */
export function checkLinks(email: ParsedEmail): Flag[] {
  const webLinks: WebLink[] = []
  const scripts: string[] = []

  for (const link of email.links) {
    const url = tryParseUrl(link.href.trim())
    if (!url) continue
    if (SCRIPT_SCHEMES.has(url.protocol)) {
      scripts.push(url.protocol)
    } else if (url.protocol === 'http:' || url.protocol === 'https:') {
      webLinks.push({ link, url, host: url.hostname.toLowerCase().replace(/\.$/, '') })
    }
  }

  const mismatches: string[] = []
  const ipHosts: string[] = []
  const atTricks: string[] = []
  const impersonated: string[] = []
  const brandNames: string[] = []
  const shorteners: string[] = []
  const insecure: string[] = []
  const riskyEndings: string[] = []

  for (const { link, url, host } of webLinks) {
    const shown = link.source === 'html' ? shownHost(link.text) : null
    if (shown && !isSameOrganization(shown, host)) mismatches.push(`${shown} → ${host}`)

    const isIp = isIpHost(host)
    if (isIp) ipHosts.push(host)
    if (url.username) atTricks.push(host)
    if (SHORTENERS.has(registrableDomain(host))) shorteners.push(host)
    if (url.protocol === 'http:') insecure.push(host)

    if (!isIp) {
      const match = findBrandImpersonation(host)
      if (match) {
        impersonated.push(host)
        brandNames.push(match.brand.name)
      }
      if (hasRiskyEnding(host)) riskyEndings.push(host)
    }
  }

  const flags: Flag[] = []

  if (mismatches.length > 0) {
    const examples = listOf(mismatches)
    flags.push({
      id: 'link-text-mismatch',
      category: 'link',
      points: 25,
      title: {
        en: 'Link text does not match where it goes',
        es: 'El texto del enlace no coincide con su destino',
      },
      explanation: {
        en: `A link shows one web address but leads to another (${examples.en}). Scammers do this so you trust a link that actually goes somewhere else.`,
        es: `Un enlace muestra una dirección web pero lleva a otra (${examples.es}). Los estafadores lo hacen para que confíes en un enlace que en realidad va a otro sitio.`,
      },
    })
  }

  if (ipHosts.length > 0) {
    const examples = listOf(ipHosts)
    flags.push({
      id: 'link-ip-address',
      category: 'link',
      points: 20,
      title: { en: 'Link goes to a raw IP address', es: 'Enlace a una dirección IP directa' },
      explanation: {
        en: `A link points to a numeric address (${examples.en}) instead of a normal website name. Legitimate companies almost never link this way.`,
        es: `Un enlace apunta a una dirección numérica (${examples.es}) en lugar del nombre de un sitio web. Las empresas legítimas casi nunca enlazan así.`,
      },
    })
  }

  if (atTricks.length > 0) {
    const examples = listOf(atTricks)
    flags.push({
      id: 'link-at-trick',
      category: 'link',
      points: 25,
      title: {
        en: 'Link hides its real address with “@”',
        es: 'Enlace que oculta su dirección real con «@»',
      },
      explanation: {
        en: `A link puts text before an “@” sign so it looks like a trusted site, but everything before the “@” is ignored and it really goes to ${examples.en}.`,
        es: `Un enlace pone texto antes de una «@» para parecer un sitio de confianza, pero todo lo que va antes de la «@» se ignora y en realidad va a ${examples.es}.`,
      },
    })
  }

  if (impersonated.length > 0) {
    const examples = listOf(impersonated)
    const brands = listOf(brandNames)
    flags.push({
      id: 'link-lookalike',
      category: 'link',
      points: 20,
      title: { en: 'Link imitates a known brand', es: 'Enlace que imita a una marca conocida' },
      explanation: {
        en: `A link goes to ${examples.en}, which imitates ${brands.en} but is not one of its official domains.`,
        es: `Un enlace va a ${examples.es}, que imita a ${brands.es} pero no es uno de sus dominios oficiales.`,
      },
    })
  }

  if (shorteners.length > 0) {
    const examples = listOf(shorteners)
    flags.push({
      id: 'link-shortener',
      category: 'link',
      points: 10,
      title: { en: 'Shortened link', es: 'Enlace acortado' },
      explanation: {
        en: `A link uses a URL shortener (${examples.en}), which hides the real destination until you click.`,
        es: `Un enlace usa un acortador de URL (${examples.es}), que oculta el destino real hasta que haces clic.`,
      },
    })
  }

  if (scripts.length > 0) {
    flags.push({
      id: 'link-javascript',
      category: 'link',
      points: 20,
      title: {
        en: 'Link runs code instead of opening a site',
        es: 'Enlace que ejecuta código en vez de abrir un sitio',
      },
      explanation: {
        en: 'A link uses a special format that runs code or embeds content directly, not a normal web address. Real emails do not need this.',
        es: 'Un enlace usa un formato especial que ejecuta código o incrusta contenido directamente, no una dirección web normal. Los correos reales no lo necesitan.',
      },
    })
  }

  if (insecure.length > 0) {
    const examples = listOf(insecure)
    flags.push({
      id: 'link-insecure',
      category: 'link',
      points: 5,
      title: { en: 'Link without HTTPS', es: 'Enlace sin HTTPS' },
      explanation: {
        en: `A link uses plain http:// (${examples.en}), so the connection is not encrypted. Trustworthy sites use https://.`,
        es: `Un enlace usa http:// sin cifrado (${examples.es}), por lo que la conexión no está protegida. Los sitios confiables usan https://.`,
      },
    })
  }

  if (riskyEndings.length > 0) {
    const examples = listOf(riskyEndings)
    flags.push({
      id: 'link-risky-ending',
      category: 'link',
      points: 5,
      title: {
        en: 'Link with an unusual domain ending',
        es: 'Enlace con terminación de dominio poco común',
      },
      explanation: {
        en: `A link goes to ${examples.en}, an ending that is cheap to register and often used for scam websites.`,
        es: `Un enlace va a ${examples.es}, una terminación barata de registrar y muy usada en sitios de estafa.`,
      },
    })
  }

  return flags
}
