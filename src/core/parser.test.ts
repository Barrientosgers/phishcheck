import { describe, expect, it } from 'vitest'
import attachmentEml from '../../tests/fixtures/phishing-factura-attachment.eml?raw'
import phishingEml from '../../tests/fixtures/phishing-northwind-login.eml?raw'
import legitimateEml from '../../tests/fixtures/legitimate-northwind-statement.eml?raw'
import { getHeader, getHeaders, parseEmail } from './parser'

describe('parseEmail: phishing login email', () => {
  it('reads sender, reply-to, return-path and subject', async () => {
    const email = await parseEmail(phishingEml)
    expect(email.from).toEqual({
      name: 'Northwind Bank Security',
      address: 'security@northwind-secure.test',
      domain: 'northwind-secure.test',
    })
    expect(email.replyTo.map((a) => a.address)).toEqual(['recovery@mail-northwind.test'])
    expect(email.returnPath?.address).toBe('bounce@mailer.example.net')
    expect(email.returnPath?.domain).toBe('mailer.example.net')
    expect(email.subject).toBe('URGENT: Verify your account within 24 hours')
  })

  it('exposes authentication headers, unfolded', async () => {
    const email = await parseEmail(phishingEml)
    const auth = getHeader(email, 'Authentication-Results')
    expect(auth).toContain('spf=fail')
    expect(auth).toContain('dkim=none')
    expect(auth).toContain('dmarc=fail')
    expect(auth).not.toContain('\n')
    expect(getHeader(email, 'received-spf')).toMatch(/^fail/)
  })

  it('extracts both bodies', async () => {
    const email = await parseEmail(phishingEml)
    expect(email.text).toContain('Your account will be suspended')
    expect(email.html).toContain('<a href=')
  })

  it('extracts links with visible text vs real destination', async () => {
    const email = await parseEmail(phishingEml)
    expect(email.links).toEqual([
      {
        text: 'https://www.northwind.example.com/login',
        href: 'http://192.0.2.45/northwind/login?id=7&ref=mail',
        source: 'html',
      },
      { text: 'Click here to unlock', href: 'http://short.test/xYz9', source: 'html' },
      // The plain-text part links to a slightly different URL, so it is reported too.
      {
        text: 'http://192.0.2.45/northwind/login',
        href: 'http://192.0.2.45/northwind/login',
        source: 'text',
      },
    ])
  })

  it('has no attachments', async () => {
    expect((await parseEmail(phishingEml)).attachments).toEqual([])
  })
})

describe('parseEmail: legitimate statement email', () => {
  it('parses a clean message', async () => {
    const email = await parseEmail(legitimateEml)
    expect(email.from?.domain).toBe('northwind.example.com')
    expect(email.replyTo).toEqual([])
    expect(getHeader(email, 'authentication-results')).toContain('dmarc=pass')
    expect(email.links).toEqual([
      {
        text: 'View your statement',
        href: 'https://www.northwind.example.com/statements',
        source: 'html',
      },
    ])
  })
})

describe('parseEmail: attachment email (Spanish)', () => {
  it('lists attachments without keeping their content', async () => {
    const email = await parseEmail(attachmentEml)
    expect(email.attachments).toEqual([
      { filename: 'factura_4471.zip', mimeType: 'application/zip', size: expect.any(Number) },
    ])
    expect(email.attachments[0].size).toBeGreaterThan(0)
  })

  it('decodes accented display names and finds plain-text links', async () => {
    const email = await parseEmail(attachmentEml)
    expect(email.from?.name).toBe('Facturación')
    expect(email.text).toContain('tarjetas de regalo')
    expect(email.links).toEqual([
      {
        text: 'https://pagos.facturas-pago.test/ver?id=4471',
        href: 'https://pagos.facturas-pago.test/ver?id=4471',
        source: 'text',
      },
    ])
  })
})

describe('parseEmail: edge cases', () => {
  it('copes with a message that has no From, body or headers of interest', async () => {
    const email = await parseEmail('Subject: hi\n\n')
    expect(email.from).toBeNull()
    expect(email.returnPath).toBeNull()
    expect(email.replyTo).toEqual([])
    expect(email.links).toEqual([])
    expect(email.attachments).toEqual([])
  })

  it('returns every value of a repeated header', async () => {
    const email = await parseEmail('Received: a\nReceived: b\nSubject: x\n\nbody')
    expect(getHeaders(email, 'RECEIVED')).toEqual(['a', 'b'])
    expect(getHeader(email, 'x-missing')).toBeUndefined()
  })
})
