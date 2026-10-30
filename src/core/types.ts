/** A mailbox such as `"Northwind Bank" <help@northwind.example.com>`. */
export interface EmailAddress {
  /** Display name, or an empty string when the header had none. */
  name: string
  /** Address exactly as sent, e.g. `help@northwind.example.com`. */
  address: string
  /** Lowercased part after the last `@`, or an empty string if there is none. */
  domain: string
}

export interface HeaderEntry {
  /** Lowercased header name, e.g. `authentication-results`. */
  name: string
  /** Unfolded header value, otherwise untouched. */
  value: string
}

export type LinkSource = 'html' | 'text'

export interface ParsedLink {
  /** What the reader sees. For links found in plain text this equals `href`. */
  text: string
  /** Where the link really points, with HTML entities decoded. */
  href: string
  source: LinkSource
}

export interface ParsedAttachment {
  /** File name as sent, or null when the part did not name one. */
  filename: string | null
  /** Lowercased MIME type as claimed by the sender (not verified). */
  mimeType: string
  /** Size in bytes. The content itself is never kept. */
  size: number
}

export interface ParsedEmail {
  /** Every header in document order, duplicates included. */
  headers: HeaderEntry[]
  from: EmailAddress | null
  replyTo: EmailAddress[]
  returnPath: EmailAddress | null
  subject: string
  /** Plain-text body, empty string if the email has none. */
  text: string
  /** Raw HTML body, empty string if the email has none. Never rendered. */
  html: string
  links: ParsedLink[]
  attachments: ParsedAttachment[]
}
