export type Language = 'en' | 'es'

/** A piece of user-facing text in every supported language. */
export type Localized = Record<Language, string>

export type FlagCategory = 'sender' | 'domain' | 'link' | 'content' | 'attachment'

/** One red flag raised by a check. The score is the capped sum of all flags' points. */
export interface Flag {
  /** Stable identifier, e.g. `spf-fail`. Used by tests and the UI, never shown to users. */
  id: string
  category: FlagCategory
  points: number
  title: Localized
  explanation: Localized
}
