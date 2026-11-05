import type { AnalysisReport } from '../../core/analyze'
import type { Language } from '../../core/flags'
import type { EmailAddress } from '../../core/types'
import { AUTH_LABELS, translator } from '../strings'

interface Props {
  lang: Language
  report: AnalysisReport
}

function formatAddress(address: EmailAddress): string {
  return address.name ? `${address.name} <${address.address}>` : address.address
}

export function SenderTable({ lang, report }: Props) {
  const t = translator(lang)
  const { email, auth } = report

  const rows: [string, string][] = [
    [t('from'), email.from ? formatAddress(email.from) : t('none')],
    [t('replyTo'), email.replyTo.length ? email.replyTo.map(formatAddress).join(', ') : t('none')],
    [t('returnPath'), email.returnPath ? formatAddress(email.returnPath) : t('none')],
    [t('subject'), email.subject || t('none')],
  ]

  return (
    <section className="card">
      <h2>{t('senderTitle')}</h2>
      <table className="kv-table">
        <tbody>
          {rows.map(([label, value]) => (
            <tr key={label}>
              <th scope="row">{label}</th>
              <td className="mono">{value}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <h3>{t('authTitle')}</h3>
      <ul className="auth-badges">
        {(['spf', 'dkim', 'dmarc'] as const).map((method) => (
          <li key={method} className={`badge auth-${auth[method]}`}>
            <span className="badge-name">{method.toUpperCase()}</span>
            <span>{AUTH_LABELS[auth[method]][lang]}</span>
          </li>
        ))}
      </ul>
    </section>
  )
}
