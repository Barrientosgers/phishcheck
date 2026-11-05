import type { FormEvent } from 'react'
import type { Language } from '../../core/flags'
import { SAMPLES } from '../samples'
import { translator } from '../strings'

interface Props {
  lang: Language
  value: string
  busy: boolean
  onChange: (value: string) => void
  onAnalyze: () => void
  onSample: (raw: string) => void
  onClear: () => void
}

export function EmailInput({ lang, value, busy, onChange, onAnalyze, onSample, onClear }: Props) {
  const t = translator(lang)

  function handleSubmit(event: FormEvent) {
    event.preventDefault() // a form submit would otherwise reload the page
    onAnalyze()
  }

  return (
    <form className="card email-input" onSubmit={handleSubmit}>
      <label htmlFor="raw-email">{t('inputLabel')}</label>
      <textarea
        id="raw-email"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={t('inputPlaceholder')}
        rows={12}
        spellCheck={false}
      />
      <div className="actions">
        <button type="submit" className="primary" disabled={busy || value.trim() === ''}>
          {busy ? t('analyzing') : t('analyze')}
        </button>
        <button type="button" onClick={onClear} disabled={value === ''}>
          {t('clear')}
        </button>
      </div>
      <div className="samples">
        <span>{t('samples')}</span>
        {SAMPLES.map((sample) => (
          <button key={sample.id} type="button" onClick={() => onSample(sample.raw)}>
            {sample.label[lang]}
          </button>
        ))}
      </div>
    </form>
  )
}
