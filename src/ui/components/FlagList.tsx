import type { Flag, Language } from '../../core/flags'
import { CATEGORY_LABELS, translator } from '../strings'

interface Props {
  lang: Language
  flags: Flag[]
}

export function FlagList({ lang, flags }: Props) {
  const t = translator(lang)

  return (
    <section className="card">
      <h2>
        {t('flagsTitle')} <span className="count">{flags.length}</span>
      </h2>
      {flags.length === 0 ? (
        <p className="muted">{t('noFlags')}</p>
      ) : (
        <ul className="flag-list">
          {flags.map((flag, index) => (
            // ids can repeat (e.g. two shortener links), so the index keeps keys unique
            <li key={`${flag.id}-${index}`} className="flag">
              <div className="flag-header">
                <span className={`tag tag-${flag.category}`}>
                  {CATEGORY_LABELS[flag.category][lang]}
                </span>
                <strong>{flag.title[lang]}</strong>
                <span className="points">
                  +{flag.points} {t('points')}
                </span>
              </div>
              <p>{flag.explanation[lang]}</p>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
