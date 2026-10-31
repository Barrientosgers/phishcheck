import { BRANDS, type Brand } from '../brands'
import { isSameOrSubdomain, isSameOrganization, publicSuffix } from '../domains'
import type { Flag } from '../flags'
import { levenshtein } from '../levenshtein'
import type { ParsedEmail } from '../types'

/** Endings that are cheap to register and heavily used for throwaway scam domains. */
const RISKY_ENDINGS = new Set([
  'xyz',
  'top',
  'click',
  'buzz',
  'icu',
  'cyou',
  'rest',
  'monster',
  'zip',
  'mov',
  'tk',
  'ml',
  'ga',
  'cf',
  'gq',
  'loan',
  'work',
])

/** The last label of a host's public suffix: `evil.xyz` gives `xyz`, `bank.co.uk` gives `uk`. */
export function domainEnding(host: string): string {
  const suffix = publicSuffix(host)
  return suffix.slice(suffix.lastIndexOf('.') + 1)
}

export function hasRiskyEnding(host: string): boolean {
  return RISKY_ENDINGS.has(domainEnding(host))
}

/** Digits and letter pairs that look like other letters: `n0rthvvind` reads as `northwind`. */
function undoLookalikes(text: string): string {
  return text
    .replace(/rn/g, 'm')
    .replace(/vv/g, 'w')
    .replace(/0/g, 'o')
    .replace(/1/g, 'l')
    .replace(/3/g, 'e')
    .replace(/5/g, 's')
}

function isOfficial(host: string, brand: Brand): boolean {
  return brand.officialDomains.some((official) => isSameOrSubdomain(host, official))
}

export interface BrandMatch {
  /** `brand-in-domain`: the real brand word is in the domain. `lookalike`: a near-miss spelling. */
  kind: 'brand-in-domain' | 'lookalike'
  brand: Brand
}

/**
 * Does this host imitate a known brand without being one of its official domains?
 * Examples: `northwind-secure.test` (brand word added) or `northwlnd.test` (misspelt).
 */
export function findBrandImpersonation(host: string): BrandMatch | null {
  const lower = host.toLowerCase()
  const suffix = publicSuffix(lower)
  const name = suffix && lower.endsWith(`.${suffix}`) ? lower.slice(0, -(suffix.length + 1)) : lower
  const tokens = name.split(/[.-]/).filter(Boolean)

  for (const brand of BRANDS) {
    if (isOfficial(lower, brand)) continue
    if (name.includes(brand.keyword)) return { kind: 'brand-in-domain', brand }

    // Very short words would match too many innocent domains, so only longer keywords
    // tolerate a one-character difference.
    const allowedEdits = brand.keyword.length >= 6 ? 1 : 0
    for (const token of tokens) {
      const fixed = undoLookalikes(token)
      const closeSpelling =
        Math.min(levenshtein(token, brand.keyword), levenshtein(fixed, brand.keyword)) <=
        allowedEdits
      if (fixed.includes(brand.keyword) || closeSpelling) return { kind: 'lookalike', brand }
    }
  }
  return null
}

interface DisplayNameSpoof {
  /** The brand the display name claims to be, if it names one. */
  brand?: Brand
  /** A domain the display name shows as if it were the address, if it contains one. */
  shownDomain?: string
}

const EMBEDDED_ADDRESS = /[a-z0-9._%+-]+@([a-z0-9-]+(?:\.[a-z0-9-]+)+)/

function findDisplayNameSpoof(email: ParsedEmail): DisplayNameSpoof | null {
  const from = email.from
  if (!from || !from.name || !from.domain) return null
  const displayName = from.name.toLowerCase()

  for (const brand of BRANDS) {
    if (displayName.includes(brand.keyword) && !isOfficial(from.domain, brand)) return { brand }
  }

  // `"help@bank.example.com" <scam@evil.test>` shows an address the mail does not come from.
  const shown = EMBEDDED_ADDRESS.exec(displayName)?.[1]
  if (shown && !isSameOrganization(shown, from.domain)) return { shownDomain: shown }

  return null
}

/** Checks on the sender's domain: lookalikes, brand abuse, display-name spoofing, odd endings. */
export function checkDomain(email: ParsedEmail): Flag[] {
  const from = email.from
  if (!from || !from.domain) return []

  const flags: Flag[] = []
  const domain = from.domain

  const match = findBrandImpersonation(domain)
  if (match?.kind === 'lookalike') {
    flags.push({
      id: 'lookalike-domain',
      category: 'domain',
      points: 25,
      title: { en: 'Lookalike domain', es: 'Dominio que imita a otro' },
      explanation: {
        en: `The sender’s domain ${domain} is spelled almost like ${match.brand.name}, but it is not one of its official domains. Scammers register near-identical names to fool quick readers.`,
        es: `El dominio del remitente, ${domain}, se escribe casi igual que ${match.brand.name}, pero no es uno de sus dominios oficiales. Los estafadores registran nombres casi idénticos para engañar a quien lee rápido.`,
      },
    })
  } else if (match?.kind === 'brand-in-domain') {
    flags.push({
      id: 'brand-in-domain',
      category: 'domain',
      points: 15,
      title: {
        en: 'Brand name in an unofficial domain',
        es: 'Nombre de una marca en un dominio no oficial',
      },
      explanation: {
        en: `The sender’s domain ${domain} contains the name ${match.brand.name}, but it does not belong to that company. Anyone can register a domain with a famous name inside it.`,
        es: `El dominio del remitente, ${domain}, contiene el nombre de ${match.brand.name}, pero no pertenece a esa empresa. Cualquiera puede registrar un dominio que incluya un nombre famoso.`,
      },
    })
  }

  const spoof = findDisplayNameSpoof(email)
  if (spoof) {
    flags.push({
      id: 'display-name-spoof',
      category: 'domain',
      points: 20,
      title: { en: 'Display name may be spoofed', es: 'El nombre mostrado puede ser falso' },
      explanation: spoof.brand
        ? {
            en: `The sender’s name says “${from.name}”, but the address is on ${domain}, which is not an official ${spoof.brand.name} domain. The name shown in your inbox is easy to fake.`,
            es: `El nombre del remitente dice “${from.name}”, pero la dirección es de ${domain}, que no es un dominio oficial de ${spoof.brand.name}. El nombre que ves en tu bandeja es fácil de falsificar.`,
          }
        : {
            en: `The sender’s name shows an address on ${spoof.shownDomain}, but the email really comes from ${domain}. The name shown in your inbox is easy to fake.`,
            es: `El nombre del remitente muestra una dirección de ${spoof.shownDomain}, pero el correo en realidad viene de ${domain}. El nombre que ves en tu bandeja es fácil de falsificar.`,
          },
    })
  }

  if (hasRiskyEnding(domain)) {
    const ending = domainEnding(domain)
    flags.push({
      id: 'risky-ending',
      category: 'domain',
      points: 10,
      title: { en: 'Unusual domain ending', es: 'Terminación de dominio poco común' },
      explanation: {
        en: `The sender’s domain ends in .${ending}, an ending that is cheap to register and often used for scam websites. Many legitimate companies never use it.`,
        es: `El dominio del remitente termina en .${ending}, una terminación barata de registrar y muy usada en sitios de estafa. Muchas empresas legítimas nunca la usan.`,
      },
    })
  }

  return flags
}
