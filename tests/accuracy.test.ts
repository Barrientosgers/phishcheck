import { beforeAll, describe, expect, it } from 'vitest'
import { analyzeEmail, VERDICT_THRESHOLDS, type AnalysisReport } from '../src/core/analyze'

/**
 * Accuracy report: runs every fixture through the engine and measures how well the verdicts
 * match the truth. The truth comes from the filename prefix: `phishing-*` or `legitimate-*`.
 *
 * "Flagged" means the verdict is Suspicious or Likely phishing. Missing a real phishing email
 * costs more than a false alarm, so a warning counts as a catch.
 *
 * Caveat: the same author wrote the checks and these samples, so the numbers are optimistic.
 * They show the engine behaves as designed, not how it would do on real-world mail.
 */

// Vite reads every matching file at build time and hands us { path: fileText }.
const FIXTURES = import.meta.glob<string>('./fixtures/*.eml', {
  query: '?raw',
  import: 'default',
  eager: true,
})

interface Result {
  name: string
  isPhishing: boolean
  report: AnalysisReport
}

interface Confusion {
  tp: number // phishing, flagged (caught)
  fp: number // legitimate, flagged (false alarm)
  tn: number // legitimate, not flagged
  fn: number // phishing, not flagged (missed)
}

function confusion(results: Result[], threshold: number): Confusion {
  const counts: Confusion = { tp: 0, fp: 0, tn: 0, fn: 0 }
  for (const { isPhishing, report } of results) {
    const flagged = report.score >= threshold
    if (isPhishing) counts[flagged ? 'tp' : 'fn']++
    else counts[flagged ? 'fp' : 'tn']++
  }
  return counts
}

/** Of everything we flagged, how much was really phishing? (1 when nothing was flagged.) */
function precision({ tp, fp }: Confusion): number {
  return tp + fp === 0 ? 1 : tp / (tp + fp)
}

/** Of all real phishing, how much did we catch? */
function recall({ tp, fn }: Confusion): number {
  return tp + fn === 0 ? 1 : tp / (tp + fn)
}

/** Harmonic mean of precision and recall: one number that is low if either one is low. */
function f1(c: Confusion): number {
  const p = precision(c)
  const r = recall(c)
  return p + r === 0 ? 0 : (2 * p * r) / (p + r)
}

const pct = (n: number) => `${(n * 100).toFixed(1)}%`.padStart(6)

function formatReport(results: Result[]): string {
  const lines: string[] = []
  const nameWidth = Math.max(...results.map((r) => r.name.length))

  lines.push('', 'Per email', '─'.repeat(nameWidth + 34))
  for (const { name, isPhishing, report } of results) {
    const flagged = report.verdict !== 'safe'
    const mark = flagged === isPhishing ? '✅' : '❌'
    lines.push(
      `${mark} ${name.padEnd(nameWidth)}  ${String(report.score).padStart(3)}  ${report.verdict.padEnd(10)}  ${report.flags.map((f) => f.id).join(', ')}`,
    )
  }

  const current = confusion(results, VERDICT_THRESHOLDS.suspicious)
  const phishing = results.filter((r) => r.isPhishing).length
  lines.push(
    '',
    `Summary at the current threshold (${VERDICT_THRESHOLDS.suspicious})`,
    `  emails: ${results.length} (${phishing} phishing, ${results.length - phishing} legitimate)`,
    `  caught: ${current.tp}   missed: ${current.fn}   false alarms: ${current.fp}   correctly safe: ${current.tn}`,
    `  precision ${pct(precision(current))}   recall ${pct(recall(current))}   F1 ${pct(f1(current))}`,
    '',
    'Threshold sweep (score at or above = flagged)',
    '  threshold  precision  recall      F1   missed  false alarms',
  )
  for (let t = 10; t <= 70; t += 5) {
    const c = confusion(results, t)
    const marker = t === VERDICT_THRESHOLDS.suspicious ? '  ← current' : ''
    lines.push(
      `  ${String(t).padStart(9)}  ${pct(precision(c)).padStart(9)}  ${pct(recall(c))}  ${pct(f1(c))}  ${String(c.fn).padStart(6)}  ${String(c.fp).padStart(12)}${marker}`,
    )
  }
  return lines.join('\n')
}

describe('accuracy on fixtures', () => {
  let results: Result[]

  beforeAll(async () => {
    results = await Promise.all(
      Object.entries(FIXTURES).map(async ([path, raw]) => {
        const name = path.replace('./fixtures/', '').replace('.eml', '')
        return { name, isPhishing: name.startsWith('phishing-'), report: await analyzeEmail(raw) }
      }),
    )
    results.sort((a, b) => a.name.localeCompare(b.name))
    console.log(formatReport(results))
  })

  // Regression guard. Floors sit a little below the first measured run (94.4% / 94.4% on
  // 30 emails): with this few samples one email moves recall by about 5.6 points, so this
  // allows one more mistake before failing. Raise them as the engine improves.
  it('keeps precision and recall above their floors', () => {
    const c = confusion(results, VERDICT_THRESHOLDS.suspicious)
    expect(precision(c)).toBeGreaterThanOrEqual(0.85)
    expect(recall(c)).toBeGreaterThanOrEqual(0.85)
  })

  it('every fixture is labeled by its filename', () => {
    const unlabeled = results.filter(
      (r) => !r.name.startsWith('phishing-') && !r.name.startsWith('legitimate-'),
    )
    expect(unlabeled.map((r) => r.name)).toEqual([])
  })
})
