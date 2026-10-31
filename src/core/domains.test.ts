import { describe, expect, it } from 'vitest'
import { isSameOrSubdomain, isSameOrganization, publicSuffix, registrableDomain } from './domains'

describe('registrableDomain', () => {
  it('strips subdomains', () => {
    expect(registrableDomain('mail.northwind.example.com')).toBe('example.com')
  })

  it('understands multi-part endings like co.uk', () => {
    expect(registrableDomain('mail.bank.co.uk')).toBe('bank.co.uk')
  })

  it('works for unknown endings and is case-insensitive', () => {
    expect(registrableDomain('Mail.Northwind-Secure.TEST')).toBe('northwind-secure.test')
  })

  it('treats shared hosting suffixes as public', () => {
    expect(registrableDomain('alice.github.io')).toBe('alice.github.io')
  })

  it('returns IP addresses unchanged', () => {
    expect(registrableDomain('192.0.2.45')).toBe('192.0.2.45')
  })
})

describe('publicSuffix', () => {
  it('returns the ending', () => {
    expect(publicSuffix('a.bank.co.uk')).toBe('co.uk')
    expect(publicSuffix('evil.xyz')).toBe('xyz')
  })
})

describe('isSameOrganization', () => {
  it('matches the same domain and sibling subdomains', () => {
    expect(isSameOrganization('mail.x.com', 'help.x.com')).toBe(true)
    expect(isSameOrganization('x.com', 'x.com')).toBe(true)
  })

  it('separates different registered domains and different shared-host tenants', () => {
    expect(isSameOrganization('x.com', 'y.com')).toBe(false)
    expect(isSameOrganization('alice.github.io', 'bob.github.io')).toBe(false)
  })
})

describe('isSameOrSubdomain', () => {
  it('accepts the parent and its subdomains only', () => {
    expect(isSameOrSubdomain('northwind.example.com', 'northwind.example.com')).toBe(true)
    expect(isSameOrSubdomain('mail.northwind.example.com', 'northwind.example.com')).toBe(true)
    expect(isSameOrSubdomain('evilnorthwind.example.com', 'northwind.example.com')).toBe(false)
    expect(isSameOrSubdomain('northwind.example.com', 'mail.northwind.example.com')).toBe(false)
  })
})
