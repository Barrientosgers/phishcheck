import type { Language } from '../../core/flags'

interface Props {
  lang: Language
  onChange: (lang: Language) => void
}

const OPTIONS: { value: Language; label: string }[] = [
  { value: 'en', label: 'EN' },
  { value: 'es', label: 'ES' },
]

export function LanguageToggle({ lang, onChange }: Props) {
  return (
    <div className="lang-toggle" role="group" aria-label="Language / Idioma">
      {OPTIONS.map((option) => (
        <button
          key={option.value}
          type="button"
          aria-pressed={lang === option.value}
          onClick={() => onChange(option.value)}
        >
          {option.label}
        </button>
      ))}
    </div>
  )
}
