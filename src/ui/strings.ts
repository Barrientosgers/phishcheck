import type { Language, Localized } from '../core/flags'

/** UI text in every supported language. Flag text comes from the engine, not from here. */
export const STRINGS = {
  tagline: {
    en: 'Paste a raw email to get an explainable phishing risk score.',
    es: 'Pega un correo en formato original para obtener una puntuación de riesgo explicada.',
  },
  privacy: {
    en: 'Your email never leaves this browser. It is analyzed locally: nothing is uploaded, and no link or attachment is ever opened.',
    es: 'Tu correo nunca sale de este navegador. Se analiza localmente: no se sube nada y nunca se abre ningún enlace ni archivo adjunto.',
  },
  inputLabel: { en: 'Raw email source (.eml)', es: 'Código fuente del correo (.eml)' },
  inputPlaceholder: {
    en: 'In your mail app, use "Show original" or "View source", copy everything, and paste it here.',
    es: 'En tu correo, usa "Mostrar original" o "Ver código fuente", copia todo y pégalo aquí.',
  },
  analyze: { en: 'Analyze', es: 'Analizar' },
  analyzing: { en: 'Analyzing…', es: 'Analizando…' },
  clear: { en: 'Clear', es: 'Borrar' },
  samples: { en: 'Try a sample:', es: 'Prueba un ejemplo:' },
  parseError: {
    en: 'This could not be read as an email. Make sure you pasted the full raw source, headers included.',
    es: 'No se pudo leer como correo. Asegúrate de pegar el código fuente completo, incluidos los encabezados.',
  },
  score: { en: 'Risk score', es: 'Puntuación de riesgo' },
  rawScoreNote: {
    en: 'Flags add up to {raw} points; the score is capped at 100.',
    es: 'Las alertas suman {raw} puntos; la puntuación máxima es 100.',
  },
  flagsTitle: { en: 'Red flags', es: 'Señales de alerta' },
  noFlags: {
    en: 'No red flags found. That is a good sign, but stay careful: no tool catches everything.',
    es: 'No se encontraron señales de alerta. Es buena señal, pero ten cuidado: ninguna herramienta lo detecta todo.',
  },
  points: { en: 'pts', es: 'pts' },
  senderTitle: { en: 'Sender', es: 'Remitente' },
  authTitle: { en: 'Authentication', es: 'Autenticación' },
  from: { en: 'From', es: 'De' },
  replyTo: { en: 'Reply-To', es: 'Responder a' },
  returnPath: { en: 'Return-Path', es: 'Return-Path' },
  subject: { en: 'Subject', es: 'Asunto' },
  none: { en: '(none)', es: '(ninguno)' },
  linksTitle: { en: 'Links', es: 'Enlaces' },
  linksNote: {
    en: 'Shown as plain text on purpose. Nothing here is clickable.',
    es: 'Se muestran como texto a propósito. Nada aquí es clicable.',
  },
  linkText: { en: 'Text shown', es: 'Texto visible' },
  linkHref: { en: 'Real destination', es: 'Destino real' },
  noLinks: { en: 'No links found.', es: 'No se encontraron enlaces.' },
  attachmentsTitle: { en: 'Attachments', es: 'Adjuntos' },
  unnamed: { en: '(unnamed)', es: '(sin nombre)' },
} satisfies Record<string, Localized>

export type StringKey = keyof typeof STRINGS

export const CATEGORY_LABELS: Record<string, Localized> = {
  sender: { en: 'Sender', es: 'Remitente' },
  domain: { en: 'Domain', es: 'Dominio' },
  link: { en: 'Link', es: 'Enlace' },
  content: { en: 'Content', es: 'Contenido' },
  attachment: { en: 'Attachment', es: 'Adjunto' },
}

export const AUTH_LABELS: Record<string, Localized> = {
  pass: { en: 'pass', es: 'aprobado' },
  fail: { en: 'fail', es: 'fallido' },
  softfail: { en: 'softfail', es: 'fallo leve' },
  neutral: { en: 'neutral', es: 'neutral' },
  none: { en: 'none', es: 'ninguno' },
  unknown: { en: 'not found', es: 'no encontrado' },
}

/** Returns a translator bound to one language, e.g. `t('analyze')`. */
export function translator(lang: Language) {
  return (key: StringKey) => STRINGS[key][lang]
}
