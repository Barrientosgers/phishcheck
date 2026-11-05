import { checkAttachments } from './checks/attachments'
import { checkContent } from './checks/content'
import { checkDomain } from './checks/domain'
import { checkLinks } from './checks/links'
import { checkSender, getAuthResults, type AuthResults } from './checks/sender'
import type { Flag } from './flags'
import { parseEmail } from './parser'
import type { ParsedEmail } from './types'
import { MAX_SCORE, verdictFor, type Verdict } from './verdict'

export { MAX_SCORE, VERDICT_LABELS, VERDICT_THRESHOLDS, verdictFor, type Verdict } from './verdict'

export interface AnalysisReport {
  /** 0-100: the sum of all flags' points, capped. */
  score: number
  /** The sum before the cap, so you can see how far past 100 an email went. */
  rawScore: number
  verdict: Verdict
  /** Every triggered flag, highest points first. */
  flags: Flag[]
  /** SPF, DKIM and DMARC as recorded by the receiving server, for the sender table. */
  auth: AuthResults
  email: ParsedEmail
}

/** Runs every check on an already-parsed email and scores the result. Pure and synchronous. */
export function analyzeParsed(email: ParsedEmail): AnalysisReport {
  const flags = [
    ...checkSender(email),
    ...checkDomain(email),
    ...checkLinks(email),
    ...checkContent(email),
    ...checkAttachments(email),
  ].sort((a, b) => b.points - a.points) // sort is stable: ties keep the order above

  const rawScore = flags.reduce((sum, flag) => sum + flag.points, 0)
  const score = Math.min(rawScore, MAX_SCORE)

  return { score, rawScore, verdict: verdictFor(score), flags, auth: getAuthResults(email), email }
}

/**
 * The engine's front door: raw email source in, explainable report out. Everything runs
 * locally. Nothing is sent anywhere and no link or attachment is ever opened.
 */
export async function analyzeEmail(raw: string): Promise<AnalysisReport> {
  return analyzeParsed(await parseEmail(raw))
}
