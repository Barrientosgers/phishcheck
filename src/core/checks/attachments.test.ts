import { describe, expect, it } from 'vitest'
import attachmentEml from '../../../tests/fixtures/phishing-factura-attachment.eml?raw'
import phishingEml from '../../../tests/fixtures/phishing-northwind-login.eml?raw'
import legitimateEml from '../../../tests/fixtures/legitimate-northwind-statement.eml?raw'
import { parseEmail } from '../parser'
import type { ParsedEmail } from '../types'
import { checkAttachments } from './attachments'

function emailWith(...filenames: (string | null)[]): ParsedEmail {
  return {
    headers: [],
    from: null,
    replyTo: [],
    returnPath: null,
    subject: '',
    text: '',
    html: '',
    links: [],
    attachments: filenames.map((filename) => ({
      filename,
      mimeType: 'application/octet-stream',
      size: 10,
    })),
  }
}

const ids = (...filenames: (string | null)[]) =>
  checkAttachments(emailWith(...filenames))
    .map((f) => f.id)
    .sort()

describe('checkAttachments: risky types', () => {
  it.each(['setup.exe', 'run.SCR', 'a.bat', 'x.js', 'x.vbs', 'x.msi', 'tool.jar', 'x.lnk'])(
    'flags %s as a program or script (30)',
    (name) => {
      const [flag] = checkAttachments(emailWith(name))
      expect(flag).toMatchObject({
        id: 'attachment-executable',
        points: 30,
        category: 'attachment',
      })
    },
  )

  it.each(['budget.xlsm', 'letter.DOCM', 'deck.pptm'])('flags %s as macro-enabled (20)', (name) => {
    expect(checkAttachments(emailWith(name))[0]).toMatchObject({
      id: 'attachment-macro',
      points: 20,
    })
  })

  it.each(['login.html', 'page.HTM', 'image.svg'])('flags %s as a web page (20)', (name) => {
    expect(checkAttachments(emailWith(name))[0]).toMatchObject({
      id: 'attachment-html',
      points: 20,
    })
  })

  it.each(['invoice.zip', 'files.rar', 'bundle.7z', 'disk.iso'])(
    'flags %s as an archive (15)',
    (name) => {
      expect(checkAttachments(emailWith(name))[0]).toMatchObject({
        id: 'attachment-archive',
        points: 15,
      })
    },
  )

  it.each(['report.pdf', 'letter.docx', 'sheet.xlsx', 'photo.jpg', 'notes.txt', 'noextension'])(
    'does not flag %s',
    (name) => {
      expect(checkAttachments(emailWith(name))).toEqual([])
    },
  )

  it('ignores attachments without a file name', () => {
    expect(checkAttachments(emailWith(null))).toEqual([])
  })
})

describe('checkAttachments: disguised names', () => {
  it('adds 10 points when a program is dressed up as a document', () => {
    const flags = checkAttachments(emailWith('invoice.pdf.exe'))
    expect(flags.map((f) => [f.id, f.points])).toEqual([
      ['attachment-executable', 30],
      ['attachment-double-extension', 10],
    ])
  })

  it('catches double extensions on web pages too', () => {
    expect(ids('statement.pdf.html')).toEqual(['attachment-double-extension', 'attachment-html'])
  })

  it('sees through trailing dots and spaces that Windows ignores', () => {
    expect(ids('report.pdf.exe. ')).toEqual([
      'attachment-double-extension',
      'attachment-executable',
    ])
  })

  it('does not call an ordinary archive a disguise', () => {
    expect(ids('photos.2026.zip')).toEqual(['attachment-archive'])
  })

  it('flags the right-to-left override trick', () => {
    const name = 'invoice‮fdp.exe'
    expect(ids(name)).toEqual(['attachment-double-extension', 'attachment-executable'])
  })
})

describe('checkAttachments: one flag per kind', () => {
  it('names at most three files and counts the rest, in both languages', () => {
    const [flag] = checkAttachments(emailWith('a.zip', 'b.zip', 'c.zip', 'd.zip', 'e.zip'))
    expect(flag.points).toBe(15)
    expect(flag.explanation.en).toContain('a.zip, b.zip, c.zip and 2 more')
    expect(flag.explanation.es).toContain('a.zip, b.zip, c.zip y 2 más')
  })

  it('stacks different kinds and writes both languages', () => {
    const flags = checkAttachments(emailWith('a.exe', 'b.docm', 'c.html', 'd.zip', 'e.pdf.exe'))
    expect(flags.map((f) => f.id).sort()).toEqual([
      'attachment-archive',
      'attachment-double-extension',
      'attachment-executable',
      'attachment-html',
      'attachment-macro',
    ])
    for (const flag of flags) {
      expect(
        flag.title.en && flag.title.es && flag.explanation.en && flag.explanation.es,
      ).toBeTruthy()
    }
  })
})

describe('checkAttachments: fixtures', () => {
  it('flags the zip in the Spanish attachment email', async () => {
    const flags = checkAttachments(await parseEmail(attachmentEml))
    expect(flags.map((f) => [f.id, f.points])).toEqual([['attachment-archive', 15]])
    expect(flags[0].explanation.en).toContain('factura_4471.zip')
  })

  it('raises nothing for emails without attachments', async () => {
    expect(checkAttachments(await parseEmail(phishingEml))).toEqual([])
    expect(checkAttachments(await parseEmail(legitimateEml))).toEqual([])
  })
})
