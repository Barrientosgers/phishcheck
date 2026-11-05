import { useRef, useState } from 'react'
import type { AnalysisReport } from '../core/analyze'
import type { Language } from '../core/flags'
import { EmailInput } from './components/EmailInput'
import { FlagList } from './components/FlagList'
import { LanguageToggle } from './components/LanguageToggle'
import { LinksTable } from './components/LinksTable'
import { PrivacyNote } from './components/PrivacyNote'
import { ScoreCard } from './components/ScoreCard'
import { SenderTable } from './components/SenderTable'
import { translator } from './strings'
import './App.css'

// Code splitting: the engine (parser, domain list, checks) is most of the JavaScript, so it
// lives in its own file. Starting the import here, outside the component, means it downloads
// in the background while the page is already showing, instead of blocking the first paint.
const engine = import('../core/analyze')

function App() {
  const [lang, setLang] = useState<Language>('en')
  const [raw, setRaw] = useState('')
  const [report, setReport] = useState<AnalysisReport | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(false)
  // Parsing is async. If a second analysis starts before the first ends, only the latest
  // one may update the screen, otherwise a slow old result could overwrite a new one.
  const latestRun = useRef(0)
  const t = translator(lang)

  async function analyze(source: string) {
    const run = ++latestRun.current
    setBusy(true)
    setError(false)
    try {
      const { analyzeEmail } = await engine
      const result = await analyzeEmail(source)
      if (run === latestRun.current) setReport(result)
    } catch {
      if (run === latestRun.current) {
        setReport(null)
        setError(true)
      }
    } finally {
      if (run === latestRun.current) setBusy(false)
    }
  }

  function loadSample(sample: string) {
    setRaw(sample)
    void analyze(sample)
  }

  function clear() {
    latestRun.current++ // discard any analysis still in flight
    setRaw('')
    setReport(null)
    setError(false)
    setBusy(false)
  }

  return (
    <div className="app" lang={lang}>
      <header className="app-header">
        <div>
          <h1>PhishCheck</h1>
          <p className="muted">{t('tagline')}</p>
        </div>
        <LanguageToggle lang={lang} onChange={setLang} />
      </header>

      <PrivacyNote text={t('privacy')} />

      <EmailInput
        lang={lang}
        value={raw}
        busy={busy}
        onChange={setRaw}
        onAnalyze={() => void analyze(raw)}
        onSample={loadSample}
        onClear={clear}
      />

      {error && (
        <p className="card error" role="alert">
          {t('parseError')}
        </p>
      )}

      {report && (
        <main className="results">
          <ScoreCard lang={lang} report={report} />
          <FlagList lang={lang} flags={report.flags} />
          <div className="two-col">
            <SenderTable lang={lang} report={report} />
            <LinksTable
              lang={lang}
              links={report.email.links}
              attachments={report.email.attachments}
            />
          </div>
        </main>
      )}
    </div>
  )
}

export default App
