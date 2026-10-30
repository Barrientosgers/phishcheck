import type { Flag } from '../flags'
import { getHeader } from '../parser'
import type { ParsedEmail } from '../types'

export type AuthStatus = 'pass' | 'fail' | 'softfail' | 'neutral' | 'none' | 'unknown'

export interface AuthResults {
  spf: AuthStatus
  dkim: AuthStatus
  dmarc: AuthStatus
}

// A Map, not an object: header values are attacker-controlled, and `{}['constructor']` is a function.
const STATUS = new Map<string, AuthStatus>([
  ['pass', 'pass'],
  ['fail', 'fail'],
  ['hardfail', 'fail'],
  ['softfail', 'softfail'],
  ['neutral', 'neutral'],
  ['none', 'none'],
])

function normalize(value: string): AuthStatus {
  return STATUS.get(value.toLowerCase()) ?? 'unknown'
}

const METHOD_RESULT = /(?<![\w.-])(spf|dkim|dmarc)\s*=\s*([a-z]+)/gi

/**
 * Reads the SPF, DKIM and DMARC verdicts that the receiving mail server recorded.
 * We cannot re-check them ourselves (that needs DNS), so we report what the headers say.
 *
 * Only the first Authentication-Results header is used. Each server adds its header on top,
 * so the first one comes from the final receiver; lower ones may have been forged by the sender.
 */
export function getAuthResults(email: ParsedEmail): AuthResults {
  const results: AuthResults = { spf: 'unknown', dkim: 'unknown', dmarc: 'unknown' }

  const header = getHeader(email, 'authentication-results')
  if (header) {
    const withoutComments = header.replace(/\([^)]*\)/g, ' ')
    const seen = { spf: false, dkim: false, dmarc: false }
    for (const match of withoutComments.matchAll(METHOD_RESULT)) {
      const method = match[1].toLowerCase() as keyof AuthResults
      const status = normalize(match[2])
      if (!seen[method]) {
        seen[method] = true
        results[method] = status
        // A message can carry several DKIM signatures; one valid signature is enough.
      } else if (method === 'dkim' && status === 'pass') {
        results.dkim = 'pass'
      }
    }
  }

  if (results.spf === 'unknown') {
    const spfHeader = getHeader(email, 'received-spf')
    const word = spfHeader ? /^\s*([a-z]+)/i.exec(spfHeader)?.[1] : undefined
    if (word) results.spf = normalize(word)
  }

  return results
}

/**
 * True when `a` and `b` are the same domain or one is a subdomain of the other.
 * Phase 3 replaces this with a registrable-domain comparison (tldts), which also treats
 * sibling subdomains like `mail.example.com` and `help.example.com` as the same organisation.
 */
function relatedDomains(a: string, b: string): boolean {
  return a === b || a.endsWith(`.${b}`) || b.endsWith(`.${a}`)
}

/** Sender authentication and identity-mismatch checks. */
export function checkSender(email: ParsedEmail): Flag[] {
  const flags: Flag[] = []
  const auth = getAuthResults(email)

  if (auth.spf === 'fail') {
    flags.push({
      id: 'spf-fail',
      category: 'sender',
      points: 25,
      title: { en: 'SPF check failed', es: 'Falló la verificación SPF' },
      explanation: {
        en: 'The server that sent this email is not authorized to send for the sender’s domain. Scammers often fake the sender this way.',
        es: 'El servidor que envió este correo no está autorizado para enviar en nombre del dominio del remitente. Los estafadores suelen falsificar el remitente así.',
      },
    })
  } else if (auth.spf === 'softfail') {
    flags.push({
      id: 'spf-softfail',
      category: 'sender',
      points: 10,
      title: { en: 'SPF check softly failed', es: 'La verificación SPF falló parcialmente' },
      explanation: {
        en: 'The sender’s domain says this server is probably not allowed to send its email. It is a weaker warning than a hard failure.',
        es: 'El dominio del remitente indica que este servidor probablemente no puede enviar sus correos. Es una advertencia más débil que un fallo total.',
      },
    })
  }

  if (auth.dkim === 'fail') {
    flags.push({
      id: 'dkim-fail',
      category: 'sender',
      points: 15,
      title: { en: 'DKIM signature failed', es: 'Falló la firma DKIM' },
      explanation: {
        en: 'The email’s digital signature is invalid, so it may have been altered or may not come from the claimed domain.',
        es: 'La firma digital del correo no es válida, por lo que pudo haber sido alterado o no provenir del dominio indicado.',
      },
    })
  }

  if (auth.dmarc === 'fail') {
    flags.push({
      id: 'dmarc-fail',
      category: 'sender',
      points: 25,
      title: { en: 'DMARC check failed', es: 'Falló la verificación DMARC' },
      explanation: {
        en: 'The email failed the domain owner’s own rules for proving a message is genuine. This is a strong sign of spoofing.',
        es: 'El correo no cumplió las reglas del propio dueño del dominio para demostrar que un mensaje es genuino. Es una señal fuerte de suplantación.',
      },
    })
  }

  const noResults = [auth.spf, auth.dkim, auth.dmarc].every((s) => s === 'unknown' || s === 'none')
  if (noResults) {
    flags.push({
      id: 'auth-missing',
      category: 'sender',
      points: 5,
      title: {
        en: 'No sender verification results',
        es: 'Sin resultados de verificación del remitente',
      },
      explanation: {
        en: 'The headers contain no SPF, DKIM or DMARC results, so we cannot confirm who really sent this. Pasted emails sometimes lose these headers, so this is a small warning.',
        es: 'Los encabezados no incluyen resultados SPF, DKIM ni DMARC, así que no podemos confirmar quién envió realmente el correo. Al pegar un correo a veces se pierden estos encabezados, por eso es una advertencia leve.',
      },
    })
  }

  const fromDomain = email.from?.domain
  if (fromDomain) {
    const replyDomain = email.replyTo
      .map((a) => a.domain)
      .find((d) => d && !relatedDomains(d, fromDomain))
    if (replyDomain) {
      flags.push({
        id: 'reply-to-mismatch',
        category: 'sender',
        points: 15,
        title: { en: 'Reply-To differs from sender', es: 'El Reply-To difiere del remitente' },
        explanation: {
          en: `The email appears to come from ${fromDomain}, but replies would go to ${replyDomain}. Scammers use this to collect answers at an address they control.`,
          es: `El correo parece venir de ${fromDomain}, pero las respuestas irían a ${replyDomain}. Los estafadores usan esto para recibir respuestas en una dirección que controlan.`,
        },
      })
    }

    // Legitimate bulk senders often use their own bounce domain. If DMARC passed, the sender
    // domain was verified anyway, so a different Return-Path is not suspicious.
    const returnDomain = email.returnPath?.domain
    if (returnDomain && auth.dmarc !== 'pass' && !relatedDomains(returnDomain, fromDomain)) {
      flags.push({
        id: 'return-path-mismatch',
        category: 'sender',
        points: 10,
        title: {
          en: 'Return-Path differs from sender',
          es: 'El Return-Path difiere del remitente',
        },
        explanation: {
          en: `The email claims to be from ${fromDomain}, but it was actually sent on behalf of ${returnDomain}.`,
          es: `El correo dice ser de ${fromDomain}, pero en realidad fue enviado a nombre de ${returnDomain}.`,
        },
      })
    }
  }

  return flags
}
