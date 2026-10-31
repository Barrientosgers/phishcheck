import { describe, expect, it } from 'vitest'
import attachmentEml from '../../tests/fixtures/phishing-factura-attachment.eml?raw'
import phishingEml from '../../tests/fixtures/phishing-northwind-login.eml?raw'
import legitimateEml from '../../tests/fixtures/legitimate-northwind-statement.eml?raw'
import { analyzeEmail, verdictFor, VERDICT_LABELS } from './analyze'

describe('verdictFor', () => {
  it('maps scores to verdicts at the thresholds', () => {
    expect(verdictFor(0)).toBe('safe')
    expect(verdictFor(24)).toBe('safe')
    expect(verdictFor(25)).toBe('suspicious')
    expect(verdictFor(59)).toBe('suspicious')
    expect(verdictFor(60)).toBe('phishing')
    expect(verdictFor(100)).toBe('phishing')
  })

  it('has a label in both languages for every verdict', () => {
    for (const label of Object.values(VERDICT_LABELS)) {
      expect(label.en && label.es).toBeTruthy()
    }
  })
})

describe('analyzeEmail: fixtures end to end', () => {
  it('rates the phishing login email as likely phishing, capped at 100', async () => {
    const report = await analyzeEmail(phishingEml)
    expect(report.verdict).toBe('phishing')
    expect(report.score).toBe(100)
    expect(report.rawScore).toBeGreaterThan(100)
    expect(report.flags.length).toBeGreaterThanOrEqual(10)
  })

  it('rates the legitimate statement email as likely safe with no flags', async () => {
    const report = await analyzeEmail(legitimateEml)
    expect(report).toMatchObject({ score: 0, verdict: 'safe', flags: [] })
  })

  it('rates the Spanish attachment email as likely phishing', async () => {
    const report = await analyzeEmail(attachmentEml)
    expect(report.flags.map((f) => f.id).sort()).toEqual([
      'attachment-archive',
      'auth-missing',
      'generic-greeting',
      'unusual-payment',
      'urgency',
    ])
    expect(report.score).toBe(60)
    expect(report.verdict).toBe('phishing')
  })
})

describe('analyzeEmail: report shape', () => {
  it('sorts flags by points, highest first, and sums them into the score', async () => {
    const report = await analyzeEmail(attachmentEml)
    const points = report.flags.map((f) => f.points)
    expect(points).toEqual([...points].sort((a, b) => b - a))
    expect(report.rawScore).toBe(points.reduce((a, b) => a + b, 0))
  })

  it('includes the authentication results and the parsed email for the UI', async () => {
    const report = await analyzeEmail(phishingEml)
    expect(report.auth).toEqual({ spf: 'fail', dkim: 'none', dmarc: 'fail' })
    expect(report.email.from?.domain).toBe('northwind-secure.test')
    expect(report.email.links.length).toBeGreaterThan(0)
  })

  it('draws flags from every category on a nasty email', async () => {
    const categories = new Set((await analyzeEmail(phishingEml)).flags.map((f) => f.category))
    expect([...categories].sort()).toEqual(['content', 'domain', 'link', 'sender'])
  })

  it('does not throw on empty or junk input', async () => {
    for (const raw of ['', 'not an email at all', '\n\n\n']) {
      const report = await analyzeEmail(raw)
      expect(report.score).toBeGreaterThanOrEqual(0)
      expect(report.score).toBeLessThanOrEqual(100)
    }
  })
})
