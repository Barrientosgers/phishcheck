import { describe, expect, it } from 'vitest'
import attachmentEml from '../../../tests/fixtures/phishing-factura-attachment.eml?raw'
import phishingEml from '../../../tests/fixtures/phishing-northwind-login.eml?raw'
import legitimateEml from '../../../tests/fixtures/legitimate-northwind-statement.eml?raw'
import { parseEmail } from '../parser'
import type { EmailAddress, ParsedEmail } from '../types'
import { checkSender, getAuthResults } from './sender'

function address(addr: string): EmailAddress {
  return { name: '', address: addr, domain: addr.slice(addr.lastIndexOf('@') + 1).toLowerCase() }
}

/** Builds an email by hand so each test controls exactly the headers it cares about. */
function makeEmail(options: {
  headers?: Record<string, string>
  from?: string
  replyTo?: string[]
  returnPath?: string
}): ParsedEmail {
  return {
    headers: Object.entries(options.headers ?? {}).map(([name, value]) => ({
      name: name.toLowerCase(),
      value,
    })),
    from: options.from ? address(options.from) : null,
    replyTo: (options.replyTo ?? []).map(address),
    returnPath: options.returnPath ? address(options.returnPath) : null,
    subject: '',
    text: '',
    html: '',
    links: [],
    attachments: [],
  }
}

const ids = (flags: { id: string }[]) => flags.map((f) => f.id).sort()

describe('getAuthResults', () => {
  it('reads SPF, DKIM and DMARC from Authentication-Results', () => {
    const email = makeEmail({
      headers: { 'Authentication-Results': 'mx.example.com; spf=pass; dkim=fail; dmarc=none' },
    })
    expect(getAuthResults(email)).toEqual({ spf: 'pass', dkim: 'fail', dmarc: 'none' })
  })

  it('is case-insensitive and ignores parenthesised comments', () => {
    const email = makeEmail({
      headers: { 'Authentication-Results': 'mx; SPF=Pass (dkim=fail inside comment); DKIM=PASS' },
    })
    expect(getAuthResults(email)).toMatchObject({ spf: 'pass', dkim: 'pass' })
  })

  it('treats one valid DKIM signature among several as a pass', () => {
    const email = makeEmail({
      headers: {
        'Authentication-Results': 'mx; dkim=fail header.d=a.test; dkim=pass header.d=b.test',
      },
    })
    expect(getAuthResults(email).dkim).toBe('pass')
  })

  it('only trusts the first Authentication-Results header', () => {
    const email = makeEmail({})
    email.headers.push(
      { name: 'authentication-results', value: 'real.example.com; spf=fail' },
      { name: 'authentication-results', value: 'forged.test; spf=pass; dkim=pass; dmarc=pass' },
    )
    expect(getAuthResults(email)).toEqual({ spf: 'fail', dkim: 'unknown', dmarc: 'unknown' })
  })

  it('falls back to Received-SPF when SPF is absent from Authentication-Results', () => {
    const email = makeEmail({ headers: { 'Received-SPF': 'softfail (example.com: not allowed)' } })
    expect(getAuthResults(email).spf).toBe('softfail')
  })

  it('maps hardfail to fail and unrecognised values to unknown', () => {
    const email = makeEmail({
      headers: { 'Authentication-Results': 'mx; spf=hardfail; dkim=constructor; dmarc=temperror' },
    })
    expect(getAuthResults(email)).toEqual({ spf: 'fail', dkim: 'unknown', dmarc: 'unknown' })
  })

  it('returns unknown for everything when there are no headers', () => {
    expect(getAuthResults(makeEmail({}))).toEqual({
      spf: 'unknown',
      dkim: 'unknown',
      dmarc: 'unknown',
    })
  })
})

describe('checkSender: individual flags', () => {
  const passing = { 'Authentication-Results': 'mx; spf=pass; dkim=pass; dmarc=pass' }

  it('scores each authentication failure', () => {
    const flags = checkSender(
      makeEmail({ headers: { 'Authentication-Results': 'mx; spf=fail; dkim=fail; dmarc=fail' } }),
    )
    expect(Object.fromEntries(flags.map((f) => [f.id, f.points]))).toEqual({
      'spf-fail': 25,
      'dkim-fail': 15,
      'dmarc-fail': 25,
    })
  })

  it('scores an SPF softfail lower than a hard fail', () => {
    const flags = checkSender(
      makeEmail({ headers: { 'Authentication-Results': 'mx; spf=softfail; dkim=pass' } }),
    )
    expect(flags).toHaveLength(1)
    expect(flags[0]).toMatchObject({ id: 'spf-softfail', points: 10 })
  })

  it('raises nothing when everything passes and domains agree', () => {
    const email = makeEmail({
      headers: passing,
      from: 'a@example.com',
      replyTo: ['a@example.com'],
      returnPath: 'a@example.com',
    })
    expect(checkSender(email)).toEqual([])
  })

  it('flags missing results only when none of SPF/DKIM/DMARC is known', () => {
    expect(ids(checkSender(makeEmail({})))).toEqual(['auth-missing'])
    expect(
      checkSender(makeEmail({ headers: { 'Authentication-Results': 'mx; spf=pass' } })),
    ).toEqual([])
  })

  it('flags a Reply-To on a different domain, naming both domains', () => {
    const email = makeEmail({
      headers: passing,
      from: 'help@bank.example.com',
      replyTo: ['help@bank.example.com', 'steal@evil.test'],
    })
    const [flag] = checkSender(email)
    expect(flag).toMatchObject({ id: 'reply-to-mismatch', points: 15 })
    expect(flag.explanation.en).toContain('bank.example.com')
    expect(flag.explanation.en).toContain('evil.test')
    expect(flag.explanation.es).toContain('evil.test')
  })

  it('accepts a Reply-To on a subdomain of the sender', () => {
    const email = makeEmail({
      headers: passing,
      from: 'a@example.com',
      replyTo: ['b@support.example.com'],
    })
    expect(checkSender(email)).toEqual([])
  })

  it('accepts a Reply-To on a sibling subdomain, and handles multi-part endings', () => {
    const siblings = makeEmail({
      headers: passing,
      from: 'a@mail.bank.co.uk',
      replyTo: ['b@help.bank.co.uk'],
    })
    expect(checkSender(siblings)).toEqual([])
  })

  it('treats different owners on a shared host as a mismatch', () => {
    const email = makeEmail({
      headers: passing,
      from: 'a@alice.github.io',
      replyTo: ['b@bob.github.io'],
    })
    expect(ids(checkSender(email))).toEqual(['reply-to-mismatch'])
  })

  it('flags a different Return-Path unless DMARC passed', () => {
    const base = { from: 'a@example.com', returnPath: 'bounce@mailer.example.net' }
    const failing = checkSender(
      makeEmail({ ...base, headers: { 'Authentication-Results': 'mx; dmarc=none; spf=none' } }),
    )
    expect(failing).toHaveLength(2) // auth-missing + return-path-mismatch
    expect(ids(failing)).toContain('return-path-mismatch')
    expect(checkSender(makeEmail({ ...base, headers: passing }))).toEqual([])
  })

  it('gives every flag text in both languages', () => {
    const email = makeEmail({
      headers: { 'Authentication-Results': 'mx; spf=fail; dkim=fail; dmarc=fail' },
      from: 'a@example.com',
      replyTo: ['b@evil.test'],
      returnPath: 'c@other.test',
    })
    const flags = checkSender(email)
    expect(flags.length).toBeGreaterThanOrEqual(5)
    for (const flag of flags) {
      expect(flag.title.en).not.toBe('')
      expect(flag.title.es).not.toBe('')
      expect(flag.explanation.en).not.toBe('')
      expect(flag.explanation.es).not.toBe('')
      expect(flag.category).toBe('sender')
    }
  })
})

describe('checkSender: fixtures', () => {
  it('flags the phishing login email heavily', async () => {
    const flags = checkSender(await parseEmail(phishingEml))
    expect(ids(flags)).toEqual([
      'dmarc-fail',
      'reply-to-mismatch',
      'return-path-mismatch',
      'spf-fail',
    ])
    expect(flags.reduce((sum, f) => sum + f.points, 0)).toBe(75)
  })

  it('raises nothing for the legitimate statement email', async () => {
    expect(checkSender(await parseEmail(legitimateEml))).toEqual([])
  })

  it('only notes missing results on the Spanish attachment email', async () => {
    expect(ids(checkSender(await parseEmail(attachmentEml)))).toEqual(['auth-missing'])
  })
})
