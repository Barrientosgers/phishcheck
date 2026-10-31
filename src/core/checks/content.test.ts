import { describe, expect, it } from 'vitest'
import attachmentEml from '../../../tests/fixtures/phishing-factura-attachment.eml?raw'
import phishingEml from '../../../tests/fixtures/phishing-northwind-login.eml?raw'
import legitimateEml from '../../../tests/fixtures/legitimate-northwind-statement.eml?raw'
import { parseEmail } from '../parser'
import type { ParsedEmail } from '../types'
import { checkContent } from './content'

function emailWith(parts: { subject?: string; text?: string; html?: string }): ParsedEmail {
  return {
    headers: [],
    from: null,
    replyTo: [],
    returnPath: null,
    subject: parts.subject ?? '',
    text: parts.text ?? '',
    html: parts.html ?? '',
    links: [],
    attachments: [],
  }
}

const ids = (parts: Parameters<typeof emailWith>[0]) =>
  checkContent(emailWith(parts))
    .map((f) => f.id)
    .sort()

describe('checkContent: urgency', () => {
  it.each([
    'Please verify your account within 24 hours.',
    'Your account will be suspended.',
    'Act now to keep access.',
    'This is your final notice.',
    'Realice el pago hoy mismo.',
    'Su cuenta será bloqueada.',
    'Este es su último aviso.',
  ])('flags: %s', (text) => {
    expect(ids({ text })).toEqual(['urgency'])
  })

  it('scores 15 and quotes what it found, in both languages', () => {
    const [flag] = checkContent(emailWith({ text: 'Respond within 48 hours or else.' }))
    expect(flag).toMatchObject({ id: 'urgency', points: 15, category: 'content' })
    expect(flag.explanation.en).toContain('Found: “within 48 hours”')
    expect(flag.explanation.es).toContain('Encontrado: “within 48 hours”')
  })

  it('also reads the subject', () => {
    expect(ids({ subject: 'Final notice: payment overdue', text: 'Hello.' })).toEqual(['urgency'])
  })
})

describe('checkContent: credential requests', () => {
  it.each([
    'Please confirm your password and card number.',
    'Send us your PIN to continue.',
    'Verify your credit card details here.',
    'Ingrese su contraseña para continuar.',
    'Confirme su número de tarjeta.',
    'Your password has expired.',
  ])('flags: %s', (text) => {
    expect(ids({ text })).toContain('credential-request')
  })

  it('scores 25', () => {
    const flags = checkContent(emailWith({ text: 'Enter your password below.' }))
    expect(flags[0]).toMatchObject({ id: 'credential-request', points: 25 })
  })

  it('does not fire on ordinary mentions of passwords', () => {
    expect(ids({ text: 'We will never ask for your password. Keep it private.' })).toEqual([])
  })
})

describe('checkContent: unusual payments', () => {
  it.each([
    'Pay the fee with gift cards.',
    'Buy an iTunes gift card and send the code.',
    'Please wire transfer the funds today.',
    'Send the money by Western Union.',
    'Send payment in bitcoin to this wallet.',
    'Pague con tarjetas de regalo.',
    'Realice una transferencia hoy.',
    'Envíe el pago en bitcoin.',
  ])('flags: %s', (text) => {
    expect(ids({ text })).toContain('unusual-payment')
  })

  it('scores 20', () => {
    const flags = checkContent(emailWith({ text: 'Pay with gift cards.' }))
    expect(flags[0]).toMatchObject({ id: 'unusual-payment', points: 20 })
  })

  it('ignores ordinary talk of cards and transfers', () => {
    expect(ids({ text: 'Your gift card balance is $20. Your transfer was received.' })).toEqual([])
  })
})

describe('checkContent: generic greetings', () => {
  it.each(['Dear customer,', 'Dear valued user,', 'Estimado cliente,', 'Hola usuario,'])(
    'flags: %s',
    (text) => {
      expect(ids({ text: `${text} your order is ready.` })).toEqual(['generic-greeting'])
    },
  )

  it('scores 5 and ignores a personal greeting', () => {
    expect(checkContent(emailWith({ text: 'Dear customer, hi.' }))[0].points).toBe(5)
    expect(ids({ text: 'Dear Maria, your order is ready.' })).toEqual([])
  })

  it('only counts a greeting near the start of the message', () => {
    const text = `${'Long introduction. '.repeat(30)} Dear customer, thanks.`
    expect(ids({ text })).toEqual([])
  })
})

describe('checkContent: matching behaviour', () => {
  it('ignores accents and capitalisation', () => {
    expect(ids({ text: 'CONFIRME SU CONTRASEÑA' })).toEqual(['credential-request'])
    expect(ids({ text: 'confirme su contrasena' })).toEqual(['credential-request'])
  })

  it('reads HTML-only emails, tags and entities included', () => {
    const html = '<p>Your <b>account</b> will&nbsp;be <i>suspended</i></p>'
    expect(ids({ html })).toEqual(['urgency'])
  })

  it('ignores wording hidden in script and style blocks', () => {
    const html = '<style>.x{content:"act now"}</style><script>var s="act now"</script><p>Hi</p>'
    expect(ids({ html })).toEqual([])
  })

  it('raises one flag per category, however often phrases repeat', () => {
    const text = 'Act now! Act now! Your account will be suspended. Final notice. Last chance.'
    expect(checkContent(emailWith({ text }))).toHaveLength(1)
  })

  it('stacks different categories', () => {
    const text = 'Dear customer, act now and pay with gift cards. Confirm your password.'
    expect(ids({ text })).toEqual([
      'credential-request',
      'generic-greeting',
      'unusual-payment',
      'urgency',
    ])
  })

  it('returns nothing for an empty email', () => {
    expect(checkContent(emailWith({}))).toEqual([])
  })

  it('writes every flag in both languages', () => {
    const text = 'Dear customer, act now and pay with gift cards. Confirm your password.'
    for (const flag of checkContent(emailWith({ text }))) {
      expect(
        flag.title.en && flag.title.es && flag.explanation.en && flag.explanation.es,
      ).toBeTruthy()
    }
  })
})

describe('checkContent: fixtures', () => {
  it('flags the phishing login email', async () => {
    const flags = checkContent(await parseEmail(phishingEml))
    expect(flags.map((f) => f.id).sort()).toEqual([
      'credential-request',
      'generic-greeting',
      'urgency',
    ])
  })

  it('raises nothing for the legitimate statement email', async () => {
    expect(checkContent(await parseEmail(legitimateEml))).toEqual([])
  })

  it('flags the Spanish attachment email', async () => {
    const flags = checkContent(await parseEmail(attachmentEml))
    expect(flags.map((f) => f.id).sort()).toEqual([
      'generic-greeting',
      'unusual-payment',
      'urgency',
    ])
  })
})
