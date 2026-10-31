import { parse } from 'tldts'

// allowPrivateDomains makes shared hosts like github.io count as public suffixes, so
// `alice.github.io` and `bob.github.io` are different owners, not one "github.io" organisation.
const OPTIONS = { allowPrivateDomains: true }

/**
 * The domain a person or company actually registered: `mail.bank.co.uk` gives `bank.co.uk`.
 * For IP addresses and names with no registrable part, the host itself is returned.
 */
export function registrableDomain(host: string): string {
  const lower = host.toLowerCase()
  return parse(lower, OPTIONS).domain ?? lower
}

/** The public suffix ("ending") of a host: `bank.co.uk` gives `co.uk`, `evil.xyz` gives `xyz`. */
export function publicSuffix(host: string): string {
  return parse(host.toLowerCase(), OPTIONS).publicSuffix ?? ''
}

/** True when both hosts belong to the same registered domain, e.g. `mail.x.com` and `help.x.com`. */
export function isSameOrganization(a: string, b: string): boolean {
  return registrableDomain(a) === registrableDomain(b)
}

/** True when `host` is `parent` or one of its subdomains. */
export function isSameOrSubdomain(host: string, parent: string): boolean {
  const h = host.toLowerCase()
  const p = parent.toLowerCase()
  return h === p || h.endsWith(`.${p}`)
}
