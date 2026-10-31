import type { Flag, Localized } from '../flags'
import type { ParsedEmail } from '../types'

const EXECUTABLE = new Set([
  'exe',
  'scr',
  'bat',
  'cmd',
  'com',
  'js',
  'jse',
  'vbs',
  'vbe',
  'wsf',
  'msi',
  'jar',
  'ps1',
  'lnk',
  'dll',
  'apk',
])
const MACRO_OFFICE = new Set(['docm', 'xlsm', 'pptm', 'dotm', 'xltm', 'xlam', 'ppam'])
const ARCHIVE = new Set(['zip', 'rar', '7z', 'iso', 'img', 'gz', 'tar', 'cab'])
const WEB_PAGE = new Set(['html', 'htm', 'xhtml', 'shtml', 'svg'])
const HARMLESS_LOOKING = new Set([
  'pdf',
  'doc',
  'docx',
  'xls',
  'xlsx',
  'ppt',
  'pptx',
  'jpg',
  'jpeg',
  'png',
  'gif',
  'txt',
  'csv',
])

type Kind = 'executable' | 'macro' | 'web-page' | 'archive'

/** Right-to-left override (U+202E): reverses how the rest of a file name is displayed. */
const RTL_OVERRIDE = '\u202e'

function extensionsOf(filename: string): string[] {
  // Windows ignores trailing dots and spaces, so "report.exe. " is still an .exe.
  const cleaned = filename
    .trim()
    .toLowerCase()
    .replace(/[. ]+$/, '')
  return cleaned.split('.').slice(1)
}

function kindOf(extension: string): Kind | null {
  if (EXECUTABLE.has(extension)) return 'executable'
  if (MACRO_OFFICE.has(extension)) return 'macro'
  if (WEB_PAGE.has(extension)) return 'web-page'
  if (ARCHIVE.has(extension)) return 'archive'
  return null
}

function names(files: string[], max = 3): Localized {
  const shown = files.slice(0, max).join(', ')
  const extra = files.length - max
  return {
    en: extra > 0 ? `${shown} and ${extra} more` : shown,
    es: extra > 0 ? `${shown} y ${extra} más` : shown,
  }
}

/**
 * Judges attachments by file name only. The content is never opened or kept. One flag per
 * kind of risk, listing up to three file names.
 */
export function checkAttachments(email: ParsedEmail): Flag[] {
  const byKind: Record<Kind, string[]> = { executable: [], macro: [], 'web-page': [], archive: [] }
  const disguised: string[] = []

  for (const { filename } of email.attachments) {
    if (!filename) continue
    const extensions = extensionsOf(filename)
    const last = extensions[extensions.length - 1]
    const kind = last ? kindOf(last) : null
    if (kind) byKind[kind].push(filename)

    const looksHarmless =
      extensions.length >= 2 && HARMLESS_LOOKING.has(extensions[extensions.length - 2])
    const doubleExtension = looksHarmless && (kind === 'executable' || kind === 'web-page')
    if (doubleExtension || filename.includes(RTL_OVERRIDE)) disguised.push(filename)
  }

  const flags: Flag[] = []

  if (byKind.executable.length > 0) {
    const files = names(byKind.executable)
    flags.push({
      id: 'attachment-executable',
      category: 'attachment',
      points: 30,
      title: { en: 'Program or script attached', es: 'Programa o script adjunto' },
      explanation: {
        en: `The email carries a file that can run code on your computer (${files.en}). Opening it can install malware.`,
        es: `El correo trae un archivo que puede ejecutar código en tu computadora (${files.es}). Abrirlo puede instalar malware.`,
      },
    })
  }

  if (byKind.macro.length > 0) {
    const files = names(byKind.macro)
    flags.push({
      id: 'attachment-macro',
      category: 'attachment',
      points: 20,
      title: { en: 'Macro-enabled Office file', es: 'Archivo de Office con macros' },
      explanation: {
        en: `The email carries an Office file that can contain macros (${files.en}). Macros are a common way to deliver malware.`,
        es: `El correo trae un archivo de Office que puede contener macros (${files.es}). Las macros son una forma común de distribuir malware.`,
      },
    })
  }

  if (byKind['web-page'].length > 0) {
    const files = names(byKind['web-page'])
    flags.push({
      id: 'attachment-html',
      category: 'attachment',
      points: 20,
      title: { en: 'Web page attached', es: 'Página web adjunta' },
      explanation: {
        en: `The email carries a web page file (${files.en}). Scammers use these to show a fake login form that looks like it came from a trusted site.`,
        es: `El correo trae un archivo de página web (${files.es}). Los estafadores los usan para mostrar un formulario de acceso falso que parece venir de un sitio confiable.`,
      },
    })
  }

  if (byKind.archive.length > 0) {
    const files = names(byKind.archive)
    flags.push({
      id: 'attachment-archive',
      category: 'attachment',
      points: 15,
      title: { en: 'Compressed archive attached', es: 'Archivo comprimido adjunto' },
      explanation: {
        en: `The email carries a compressed file (${files.en}). Archives are often used to hide malware from email scanners.`,
        es: `El correo trae un archivo comprimido (${files.es}). Los archivos comprimidos suelen usarse para esconder malware de los escáneres de correo.`,
      },
    })
  }

  if (disguised.length > 0) {
    const files = names(disguised)
    flags.push({
      id: 'attachment-double-extension',
      category: 'attachment',
      points: 10,
      title: { en: 'File disguised as another type', es: 'Archivo disfrazado de otro tipo' },
      explanation: {
        en: `A file name is made to look like a harmless document but is not (${files.en}). The real file type is the last one in the name.`,
        es: `El nombre de un archivo está hecho para parecer un documento inofensivo pero no lo es (${files.es}). El tipo real es el último del nombre.`,
      },
    })
  }

  return flags
}
