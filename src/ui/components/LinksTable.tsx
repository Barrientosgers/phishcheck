import type { Language } from '../../core/flags'
import type { ParsedAttachment, ParsedLink } from '../../core/types'
import { translator } from '../strings'

interface Props {
  lang: Language
  links: ParsedLink[]
  attachments: ParsedAttachment[]
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

/**
 * Links are rendered as plain text, never as <a href>. A phishing link must not be one
 * accidental click away, and React escapes the text so nothing in it can run as HTML.
 */
export function LinksTable({ lang, links, attachments }: Props) {
  const t = translator(lang)

  return (
    <section className="card">
      <h2>
        {t('linksTitle')} <span className="count">{links.length}</span>
      </h2>
      {links.length === 0 ? (
        <p className="muted">{t('noLinks')}</p>
      ) : (
        <>
          <p className="muted">{t('linksNote')}</p>
          <div className="table-scroll">
            <table className="links-table">
              <thead>
                <tr>
                  <th scope="col">{t('linkText')}</th>
                  <th scope="col">{t('linkHref')}</th>
                </tr>
              </thead>
              <tbody>
                {links.map((link, index) => (
                  <tr key={index}>
                    <td>{link.text}</td>
                    <td className="mono">{link.href}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {attachments.length > 0 && (
        <>
          <h3>
            {t('attachmentsTitle')} <span className="count">{attachments.length}</span>
          </h3>
          <ul className="attachments">
            {attachments.map((file, index) => (
              <li key={index} className="mono">
                {file.filename ?? t('unnamed')} · {file.mimeType} · {formatSize(file.size)}
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  )
}
