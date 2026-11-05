// `?raw` makes Vite import the file's text as a string at build time, so the sample
// buttons reuse the exact fixtures the tests use. No network request is involved.
import legitimate from '../../tests/fixtures/legitimate-northwind-statement.eml?raw'
import factura from '../../tests/fixtures/phishing-factura-attachment.eml?raw'
import login from '../../tests/fixtures/phishing-northwind-login.eml?raw'
import type { Localized } from '../core/flags'

export interface Sample {
  id: string
  label: Localized
  raw: string
}

export const SAMPLES: Sample[] = [
  {
    id: 'legitimate',
    label: { en: 'Bank statement (legitimate)', es: 'Estado de cuenta (legítimo)' },
    raw: legitimate,
  },
  {
    id: 'login',
    label: { en: 'Fake login alert (phishing)', es: 'Alerta de acceso falsa (phishing)' },
    raw: login,
  },
  {
    id: 'factura',
    label: { en: 'Spanish invoice (phishing)', es: 'Factura en español (phishing)' },
    raw: factura,
  },
]
