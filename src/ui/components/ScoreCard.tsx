import type { AnalysisReport } from '../../core/analyze'
import { MAX_SCORE, VERDICT_LABELS } from '../../core/verdict'
import type { Language } from '../../core/flags'
import { translator } from '../strings'

interface Props {
  lang: Language
  report: AnalysisReport
}

export function ScoreCard({ lang, report }: Props) {
  const t = translator(lang)
  const { score, rawScore, verdict } = report

  return (
    <section className={`card score-card verdict-${verdict}`} aria-live="polite">
      <div className="score-number">
        <span className="score-value">{score}</span>
        <span className="score-max">/ {MAX_SCORE}</span>
      </div>
      <div className="score-details">
        <p className="score-label">{t('score')}</p>
        <p className="verdict">{VERDICT_LABELS[verdict][lang]}</p>
        <meter
          min={0}
          max={MAX_SCORE}
          value={score}
          aria-label={t('score')}
          className="score-meter"
        />
        {rawScore > MAX_SCORE && (
          <p className="muted">{t('rawScoreNote').replace('{raw}', String(rawScore))}</p>
        )}
      </div>
    </section>
  )
}
