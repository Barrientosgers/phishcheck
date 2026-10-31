import {
  CREDENTIAL_PATTERNS,
  GREETING_PATTERNS,
  PAYMENT_PATTERNS,
  URGENCY_PATTERNS,
} from '../content-patterns'
import type { Flag, Localized } from '../flags'
import { decodeEntities } from '../links'
import type { ParsedEmail } from '../types'

/** Lowercase, remove accents ("verificación" becomes "verificacion"), collapse whitespace. */
function normalize(text: string): string {
  return text.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().replace(/\s+/g, ' ').trim()
}

/** Visible text of an HTML body. Pure string work: nothing is rendered or executed. */
function htmlToText(html: string): string {
  const withoutCode = html.replace(/<(script|style)\b[\s\S]*?<\/\1\s*>/gi, ' ')
  return decodeEntities(withoutCode.replace(/<[^>]*>/g, ' '))
}

interface Category {
  id: string
  points: number
  patterns: readonly RegExp[]
  /** Look only at the first characters of each body (greetings). */
  startOnly?: boolean
  title: Localized
  explanation: Localized
}

const GREETING_WINDOW = 200

const CATEGORIES: readonly Category[] = [
  {
    id: 'credential-request',
    points: 25,
    patterns: CREDENTIAL_PATTERNS,
    title: {
      en: 'Asks for passwords or card details',
      es: 'Pide contraseñas o datos de tarjeta',
    },
    explanation: {
      en: 'The message asks you to hand over a password, PIN or card number. Real companies never ask for these by email.',
      es: 'El mensaje te pide entregar una contraseña, un PIN o un número de tarjeta. Las empresas reales nunca los piden por correo.',
    },
  },
  {
    id: 'unusual-payment',
    points: 20,
    patterns: PAYMENT_PATTERNS,
    title: { en: 'Unusual payment request', es: 'Solicitud de pago inusual' },
    explanation: {
      en: 'The message asks for payment by gift card, wire transfer or cryptocurrency. These methods are hard to trace or reverse, which is why scammers prefer them.',
      es: 'El mensaje pide un pago con tarjetas de regalo, transferencia o criptomonedas. Son métodos difíciles de rastrear o revertir, por eso los estafadores los prefieren.',
    },
  },
  {
    id: 'urgency',
    points: 15,
    patterns: URGENCY_PATTERNS,
    title: { en: 'Urgent or threatening language', es: 'Lenguaje urgente o amenazante' },
    explanation: {
      en: 'The message pushes you to act fast or warns of consequences like a suspended account. Pressure stops you from thinking carefully.',
      es: 'El mensaje te presiona para actuar rápido o advierte consecuencias como una cuenta suspendida. La presión evita que pienses con calma.',
    },
  },
  {
    id: 'generic-greeting',
    points: 5,
    patterns: GREETING_PATTERNS,
    startOnly: true,
    title: { en: 'Generic greeting', es: 'Saludo genérico' },
    explanation: {
      en: 'The message greets you as “customer” or “user” instead of by name. Mass-mailed scams do not know who you are.',
      es: 'El mensaje te saluda como «cliente» o «usuario» en lugar de por tu nombre. Las estafas masivas no saben quién eres.',
    },
  },
]

function quote(matches: string[]): Localized {
  const shown = matches
    .slice(0, 2)
    .map((m) => `“${m}”`)
    .join(', ')
  return { en: ` Found: ${shown}.`, es: ` Encontrado: ${shown}.` }
}

/** Looks for scam-style wording in the subject and body, in English and Spanish. */
export function checkContent(email: ParsedEmail): Flag[] {
  const subject = normalize(email.subject)
  const bodies = [normalize(email.text), normalize(htmlToText(email.html))].filter(Boolean)
  const whole = bodies.map((body) => `${subject} ${body}`)
  if (whole.length === 0) whole.push(subject)

  const flags: Flag[] = []
  for (const category of CATEGORIES) {
    const targets = category.startOnly ? bodies.map((b) => b.slice(0, GREETING_WINDOW)) : whole
    const matches = new Set<string>()
    for (const target of targets) {
      for (const pattern of category.patterns) {
        const found = pattern.exec(target)
        if (found) matches.add(found[0])
      }
    }
    if (matches.size === 0) continue

    const found = quote([...matches])
    flags.push({
      id: category.id,
      category: 'content',
      points: category.points,
      title: category.title,
      explanation: {
        en: category.explanation.en + found.en,
        es: category.explanation.es + found.es,
      },
    })
  }
  return flags
}
