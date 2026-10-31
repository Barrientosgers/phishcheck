import { describe, expect, it } from 'vitest'
import attachmentEml from '../../../tests/fixtures/phishing-factura-attachment.eml?raw'
import phishingEml from '../../../tests/fixtures/phishing-northwind-login.eml?raw'
import legitimateEml from '../../../tests/fixtures/legitimate-northwind-statement.eml?raw'
import { parseEmail } from '../parser'
import type { ParsedEmail } from '../types'
import { checkLinks } from './links'

function emailWith(...links: [text: string, href: string][]): ParsedEmail {
  return {
    headers: [],
    from: null,
    replyTo: [],
    returnPath: null,
    subject: '',
    text: '',
    html: '',
    links: links.map(([text, href]) => ({ text, href, source: 'html' as const })),
    attachments: [],
  }
}

const ids = (email: ParsedEmail) =>
  checkLinks(email)
    .map((f) => f.id)
    .sort()

describe('checkLinks: individual flags', () => {
  it('raises nothing for an ordinary https link to an official domain', () => {
    expect(ids(emailWith(['View statement', 'https://www.northwind.example.com/s']))).toEqual([])
  })

  it('flags visible text that names a different site than the destination', () => {
    const flags = checkLinks(emailWith(['https://northwind.example.com', 'https://evil.test/x']))
    expect(flags).toHaveLength(1)
    expect(flags[0]).toMatchObject({ id: 'link-text-mismatch', points: 25, category: 'link' })
    expect(flags[0].explanation.en).toContain('northwind.example.com → evil.test')
  })

  it('catches address-like text without a scheme, but ignores plain words and file names', () => {
    expect(ids(emailWith(['northwind.example.com/login', 'https://evil.test/']))).toEqual([
      'link-text-mismatch',
    ])
    expect(ids(emailWith(['Click here', 'https://evil.test/']))).toEqual([])
    expect(ids(emailWith(['invoice.pdf', 'https://evil.test/']))).toEqual([])
  })

  it('accepts matching text on the same organisation, subdomains included', () => {
    expect(ids(emailWith(['www.bank.co.uk', 'https://login.bank.co.uk/']))).toEqual([])
  })

  it('flags raw IP addresses, including numeric spellings that URL parsing normalises', () => {
    for (const href of [
      'https://192.0.2.45/a',
      'https://3232235777/a',
      'https://[2001:db8::1]/a',
    ]) {
      expect(ids(emailWith(['Open', href])), href).toEqual(['link-ip-address'])
    }
  })

  it('flags the @ trick and reports where the link really goes', () => {
    const flags = checkLinks(emailWith(['Open', 'https://northwind.example.com@evil.test/login']))
    expect(flags.map((f) => f.id)).toEqual(['link-at-trick'])
    expect(flags[0].points).toBe(25)
    expect(flags[0].explanation.en).toContain('evil.test')
  })

  it('flags links to lookalike and brand-abusing domains, naming the brand', () => {
    const lookalike = checkLinks(emailWith(['Log in', 'https://northwlnd.test/login']))
    expect(lookalike[0]).toMatchObject({ id: 'link-lookalike', points: 20 })
    expect(lookalike[0].explanation.en).toContain('Northwind Bank')

    expect(ids(emailWith(['Log in', 'https://northwind-secure.test/']))).toEqual(['link-lookalike'])
    expect(ids(emailWith(['Log in', 'https://northwind.example.com/']))).toEqual([])
  })

  it('flags URL shorteners, including subdomains of them', () => {
    expect(ids(emailWith(['Go', 'https://bit.ly/abc']))).toEqual(['link-shortener'])
    expect(ids(emailWith(['Go', 'https://go.tinyurl.com/abc']))).toEqual(['link-shortener'])
  })

  it('flags plain http, but not https', () => {
    expect(ids(emailWith(['Go', 'http://www.example.com/']))).toEqual(['link-insecure'])
    expect(ids(emailWith(['Go', 'https://www.example.com/']))).toEqual([])
  })

  it('flags risky domain endings on links, but not on IP addresses', () => {
    expect(ids(emailWith(['Go', 'https://prizes.xyz/']))).toEqual(['link-risky-ending'])
    expect(ids(emailWith(['Go', 'https://192.0.2.1/']))).toEqual(['link-ip-address'])
  })

  it('flags script-style links with a data: or javascript: scheme', () => {
    for (const href of ['javascript:alert(1)', 'JavaScript:void(0)', 'data:text/html,<b>x</b>']) {
      expect(ids(emailWith(['Open', href])), href).toEqual(['link-javascript'])
    }
  })

  it('ignores mailto, tel, relative and malformed links', () => {
    const email = emailWith(
      ['Write us', 'mailto:help@example.com'],
      ['Call', 'tel:+15550100'],
      ['Page', '/relative/path'],
      ['Broken', 'http://'],
    )
    expect(checkLinks(email)).toEqual([])
  })

  it('treats protocol-relative links as https', () => {
    expect(ids(emailWith(['Go', '//prizes.xyz/win']))).toEqual(['link-risky-ending'])
  })

  it('does not mark text-only URLs as text mismatches', () => {
    const email = emailWith()
    email.links = [{ text: 'https://evil.test/', href: 'https://evil.test/', source: 'text' }]
    expect(checkLinks(email)).toEqual([])
  })
})

describe('checkLinks: one flag per kind', () => {
  it('does not stack points when the same trick repeats', () => {
    const links = Array.from({ length: 10 }, (_, i): [string, string] => [
      'Go',
      `http://192.0.2.${i + 1}/x`,
    ])
    const flags = checkLinks(emailWith(...links))
    expect(flags.map((f) => f.id).sort()).toEqual(['link-insecure', 'link-ip-address'])
    expect(flags.reduce((sum, f) => sum + f.points, 0)).toBe(25)
  })

  it('names at most three examples and counts the rest, in both languages', () => {
    const links = Array.from({ length: 5 }, (_, i): [string, string] => [
      'Go',
      `https://192.0.2.${i + 1}/x`,
    ])
    const [flag] = checkLinks(emailWith(...links))
    expect(flag.explanation.en).toContain('192.0.2.1, 192.0.2.2, 192.0.2.3 and 2 more')
    expect(flag.explanation.es).toContain('192.0.2.1, 192.0.2.2, 192.0.2.3 y 2 más')
  })

  it('writes every flag in both languages', () => {
    const email = emailWith(
      ['https://bank.com', 'http://192.0.2.9@evil.xyz/'],
      ['Go', 'https://bit.ly/x'],
      ['Go', 'javascript:alert(1)'],
      ['Go', 'https://northwlnd.test/'],
    )
    const flags = checkLinks(email)
    expect(flags.length).toBeGreaterThanOrEqual(6)
    for (const flag of flags) {
      expect(
        flag.title.en && flag.title.es && flag.explanation.en && flag.explanation.es,
      ).toBeTruthy()
      expect(flag.category).toBe('link')
    }
  })
})

describe('checkLinks: fixtures', () => {
  it('flags the phishing login email (60 points)', async () => {
    const flags = checkLinks(await parseEmail(phishingEml))
    expect(flags.map((f) => f.id).sort()).toEqual([
      'link-insecure',
      'link-ip-address',
      'link-shortener',
      'link-text-mismatch',
    ])
    expect(flags.reduce((sum, f) => sum + f.points, 0)).toBe(60)
  })

  it('raises nothing for the legitimate statement email', async () => {
    expect(checkLinks(await parseEmail(legitimateEml))).toEqual([])
  })

  it('raises nothing for the Spanish attachment email (https link, no tricks)', async () => {
    expect(checkLinks(await parseEmail(attachmentEml))).toEqual([])
  })
})
