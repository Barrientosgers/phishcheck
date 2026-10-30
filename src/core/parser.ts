import PostalMime from 'postal-mime'
import type { Address } from 'postal-mime'
import { extractLinks } from './links'
import type { EmailAddress, ParsedAttachment, ParsedEmail } from './types'

function toEmailAddress(name: string, address: string): EmailAddress {
  const at = address.lastIndexOf('@')
  return { name, address, domain: at === -1 ? '' : address.slice(at + 1).toLowerCase() }
}

function fromAddress(value: Address | undefined): EmailAddress | null {
  // A group (`Team: a@x, b@x;`) is not a valid From in practice; use its first member.
  const mailbox = value?.group ? value.group[0] : value
  return mailbox?.address ? toEmailAddress(mailbox.name, mailbox.address) : null
}

function fromReturnPath(value: string | undefined): EmailAddress | null {
  if (!value) return null
  const address = (/<([^>]*)>/.exec(value)?.[1] ?? value).trim()
  return address ? toEmailAddress('', address) : null
}

function byteLength(content: ArrayBuffer | Uint8Array | string): number {
  return typeof content === 'string' ? content.length : content.byteLength
}

/**
 * Turns a raw email (RFC 822 source, headers + body) into the structured data the checks use.
 * Runs entirely locally; attachments and links are described, never opened.
 */
export async function parseEmail(raw: string): Promise<ParsedEmail> {
  const email = await PostalMime.parse(raw)

  const html = email.html ?? ''
  const text = email.text ?? ''

  const attachments: ParsedAttachment[] = email.attachments.map((attachment) => ({
    filename: attachment.filename,
    mimeType: attachment.mimeType,
    size: byteLength(attachment.content),
  }))

  return {
    headers: email.headers.map((header) => ({ name: header.key, value: header.value })),
    from: fromAddress(email.from),
    replyTo: (email.replyTo ?? []).flatMap((entry) => fromAddress(entry) ?? []),
    returnPath: fromReturnPath(email.returnPath),
    subject: email.subject ?? '',
    text,
    html,
    links: extractLinks(html, text),
    attachments,
  }
}

/** All values of a header (case-insensitive). Some headers, like Received, appear many times. */
export function getHeaders(email: ParsedEmail, name: string): string[] {
  const wanted = name.toLowerCase()
  return email.headers.filter((header) => header.name === wanted).map((header) => header.value)
}

/** First value of a header, or undefined when it is absent. */
export function getHeader(email: ParsedEmail, name: string): string | undefined {
  return getHeaders(email, name)[0]
}
