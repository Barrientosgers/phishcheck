import type { Localized } from './flags'

// Kept apart from analyze.ts on purpose: these constants are tiny and have no dependencies,
// so the UI can import them without pulling the parser and every check into the first load.

export type Verdict = 'safe' | 'suspicious' | 'phishing'

export const MAX_SCORE = 100

/** Lowest score of each verdict. Checked against the fixtures by tests/accuracy.test.ts. */
export const VERDICT_THRESHOLDS = { suspicious: 25, phishing: 60 } as const

export const VERDICT_LABELS: Record<Verdict, Localized> = {
  safe: { en: 'Likely safe', es: 'Probablemente seguro' },
  suspicious: { en: 'Suspicious', es: 'Sospechoso' },
  phishing: { en: 'Likely phishing', es: 'Probable phishing' },
}

export function verdictFor(score: number): Verdict {
  if (score >= VERDICT_THRESHOLDS.phishing) return 'phishing'
  if (score >= VERDICT_THRESHOLDS.suspicious) return 'suspicious'
  return 'safe'
}
