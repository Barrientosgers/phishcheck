import { describe, expect, it } from 'vitest'
import attachmentEml from '../../../tests/fixtures/phishing-factura-attachment.eml?raw'
import phishingEml from '../../../tests/fixtures/phishing-northwind-login.eml?raw'
import legitimateEml from '../../../tests/fixtures/legitimate-northwind-statement.eml?raw'
import { parseEmail } from '../parser'
import type { ParsedEmail } from '../types'
import { checkDomain, findBrandImpersonation, hasRiskyEnding } from './domain'

function makeEmail(name: string, address: string): ParsedEmail {
  return {
    headers: [],
    from: address
      ? { name, address, domain: address.slice(address.lastIndexOf('@') + 1).toLowerCase() }
      : null,
    replyTo: [],
    returnPath: null,
    subject: '',
    text: '',
    html: '',
    links: [],
    attachments: [],
  }
}

const ids = (flags: { id: string }[]) => flags.map((f) => f.id).sort()

describe('findBrandImpersonation', () => {
  it('accepts official domains and their subdomains', () => {
    expect(findBrandImpersonation('northwind.example.com')).toBeNull()
    expect(findBrandImpersonation('mail.northwind.example.com')).toBeNull()
  })

  it('ignores unrelated domains', () => {
    expect(findBrandImpersonation('example.com')).toBeNull()
    expect(findBrandImpersonation('windmill-farm.org')).toBeNull()
  })

  it('finds the brand word inside an unofficial domain', () => {
    const cases = ['northwind-secure.test', 'login.northwind.evil.test', 'securenorthwind.test']
    for (const host of cases) {
      expect(findBrandImpersonation(host)).toMatchObject({ kind: 'brand-in-domain' })
    }
  })

  it('finds near-miss spellings and character swaps', () => {
    const cases = ['northwlnd.test', 'northwnd.test', 'n0rthwind.test', 'northvvind.test']
    for (const host of cases) {
      expect(findBrandImpersonation(host), host).toMatchObject({
        kind: 'lookalike',
        brand: { name: 'Northwind Bank' },
      })
    }
  })

  it('finds a misspelling hidden in one part of a hyphenated name', () => {
    expect(findBrandImpersonation('contos0-pay-login.test')).toMatchObject({ kind: 'lookalike' })
  })

  it('does not treat the domain ending as part of the name', () => {
    expect(findBrandImpersonation('example.northwind')).toBeNull()
  })
})

describe('hasRiskyEnding', () => {
  it('flags cheap abuse-prone endings, including under multi-part suffix rules', () => {
    expect(hasRiskyEnding('prize.xyz')).toBe(true)
    expect(hasRiskyEnding('a.b.top')).toBe(true)
  })

  it('does not flag ordinary endings', () => {
    expect(hasRiskyEnding('bank.com')).toBe(false)
    expect(hasRiskyEnding('bank.co.uk')).toBe(false)
  })
})

describe('checkDomain: individual flags', () => {
  it('scores a lookalike domain at 25 and names the brand and domain', () => {
    const [flag] = checkDomain(makeEmail('', 'help@northwlnd.test'))
    expect(flag).toMatchObject({ id: 'lookalike-domain', points: 25, category: 'domain' })
    expect(flag.explanation.en).toContain('northwlnd.test')
    expect(flag.explanation.es).toContain('Northwind Bank')
  })

  it('scores a brand in an unofficial domain at 15', () => {
    const flags = checkDomain(makeEmail('', 'help@northwind-support.test'))
    expect(flags.map((f) => [f.id, f.points])).toEqual([['brand-in-domain', 15]])
  })

  it('flags display-name spoofing at 20 when the name claims a brand', () => {
    const flags = checkDomain(makeEmail('Northwind Bank Support', 'help@gmail-clone.test'))
    expect(flags.map((f) => [f.id, f.points])).toEqual([['display-name-spoof', 20]])
  })

  it('does not flag the brand name on its official domain', () => {
    expect(checkDomain(makeEmail('Northwind Bank', 'noreply@northwind.example.com'))).toEqual([])
  })

  it('flags a display name that shows a different address', () => {
    const flags = checkDomain(makeEmail('support@fabrikam.example.com', 'x@random-mail.test'))
    expect(ids(flags)).toEqual(['display-name-spoof'])
    expect(flags[0].explanation.en).toContain('fabrikam.example.com')
  })

  it('accepts a display name showing an address on the same organisation', () => {
    expect(checkDomain(makeEmail('help@bank.com', 'noreply@mail.bank.com'))).toEqual([])
  })

  it('flags a risky ending at 10 and states which one', () => {
    const [flag] = checkDomain(makeEmail('', 'deals@cheap-prizes.xyz'))
    expect(flag).toMatchObject({ id: 'risky-ending', points: 10 })
    expect(flag.explanation.en).toContain('.xyz')
  })

  it('stacks several tricks on one sender', () => {
    const flags = checkDomain(makeEmail('Northwind Bank', 'a@northwind-login.top'))
    expect(ids(flags)).toEqual(['brand-in-domain', 'display-name-spoof', 'risky-ending'])
    expect(flags.reduce((sum, f) => sum + f.points, 0)).toBe(45)
  })

  it('returns nothing without a sender', () => {
    expect(checkDomain(makeEmail('', ''))).toEqual([])
  })

  it('writes every flag in both languages', () => {
    const flags = checkDomain(makeEmail('Northwind Bank', 'a@northwlnd.top'))
    expect(flags.length).toBeGreaterThanOrEqual(3)
    for (const flag of flags) {
      expect(
        flag.title.en && flag.title.es && flag.explanation.en && flag.explanation.es,
      ).toBeTruthy()
    }
  })
})

describe('checkDomain: fixtures', () => {
  it('flags the phishing login email', async () => {
    const flags = checkDomain(await parseEmail(phishingEml))
    expect(ids(flags)).toEqual(['brand-in-domain', 'display-name-spoof'])
  })

  it('raises nothing for the legitimate statement email', async () => {
    expect(checkDomain(await parseEmail(legitimateEml))).toEqual([])
  })

  it('raises nothing for the Spanish attachment email (its tells are elsewhere)', async () => {
    expect(checkDomain(await parseEmail(attachmentEml))).toEqual([])
  })
})
