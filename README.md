# PhishCheck

[![CI](https://github.com/Barrientosgers/phishcheck/actions/workflows/ci.yml/badge.svg)](https://github.com/Barrientosgers/phishcheck/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

**An explainable phishing email analyzer that runs entirely in your browser.**

Paste a raw email and PhishCheck gives you a risk score from 0 to 100, a verdict (_Likely safe_, _Suspicious_ or _Likely phishing_), and every red flag it found, each with a plain-language explanation in English and Spanish.

**[Try the live demo →](https://barrientosgers.github.io/phishcheck/)**

<!-- Demo GIF: record one, save it as docs/demo.gif, then uncomment the line below.
![PhishCheck analyzing a sample phishing email](docs/demo.gif)
-->

## Why explainable?

Many filters give you only a yes or a no. PhishCheck shows its reasoning: each flag says what was found, why it matters, and how many points it added. That makes it useful for learning to spot phishing yourself, not just for trusting a black box.

## What it checks

| Category            | Examples of red flags (points)                                                                                                                                                                                 |
| ------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Sender**          | SPF fail (25), DMARC fail (25), DKIM fail (15), Reply-To goes to a different organization (15), Return-Path mismatch (10), no authentication results at all (5)                                                |
| **Domain**          | Lookalike of a known brand, like `n0rthwind` (25), display name claims a brand the address doesn't belong to (20), brand name inside an unofficial domain (15), unusual endings like `.xyz` or `.top` (10)     |
| **Links**           | Link text shows one site but points to another (25), `@` trick that hides the real host (25), raw IP address (20), lookalike link domain (20), `javascript:` links (20), URL shorteners (10), plain `http` (5) |
| **Content** (EN/ES) | Requests for passwords or card numbers (25), gift cards, wire transfers or crypto (20), urgency and threats (15), generic greetings like "Dear customer" (5)                                                   |
| **Attachments**     | Executables (30), macro-enabled Office files (20), `.html` attachments (20), archives (15), double extensions like `factura.pdf.exe` (10)                                                                      |

The score is the sum of all flags, capped at 100. **25 or more** is _Suspicious_ and **60 or more** is _Likely phishing_. These thresholds were chosen with the accuracy report below.

## How it works

```
raw email ──► parser ──► sender ─┐
 (pasted)   (postal-mime) domain ─┤
                          links ──┼──► weighted flags ──► score (cap 100) ──► verdict
                          content ┤
                          attachments
```

1. **Parse.** [postal-mime](https://github.com/postalsys/postal-mime) turns the raw text into headers, plain-text and HTML bodies, and attachment metadata. Links are pulled out of both bodies with their visible text.
2. **Check.** Five groups of checks each return a list of flags. Domains are compared by their _registrable domain_ (via [tldts](https://github.com/remusao/tldts)), so `mail.northwind.example.com` and `northwind.example.com` count as the same organization, and suffixes like `co.uk` are handled correctly. Lookalike domains are found with a hand-written Levenshtein distance after undoing common tricks (`0`→`o`, `rn`→`m`, `vv`→`w`).
3. **Score.** Points are added up, capped at 100, and mapped to a verdict.

### Architecture

```
src/
  core/   the detection engine: pure TypeScript, no DOM, no network, no React
  ui/     the React web app
tests/
  fixtures/          30 sample emails (fictional brands, example.com addresses)
  accuracy.test.ts   precision/recall report and regression guard
```

The engine in `src/core/` is deliberately kept pure: ESLint blocks `window`, `document`, `fetch`, React, and any import from `ui/`. That keeps it easy to test, and it means a planned Chrome extension can reuse exactly the same engine.

## Privacy and safety

- **Your email never leaves your browser.** There is no server and no API. Analysis runs locally in JavaScript.
- **Links are never opened.** They are shown as plain text, not clickable links, and the analyzer never fetches them.
- **The email's HTML is never rendered,** so nothing inside a malicious email can run on the page.
- **Attachments are never opened.** Only their names, types and sizes are read.
- **All samples are fictional.** Brands like "Northwind Bank" and addresses like `example.com` are made up. No real personal data is in this repo.

PhishCheck is a learning and portfolio project. It is a second opinion, not a replacement for your mail provider's filtering.

## Accuracy

`npm run accuracy` runs all 30 sample emails (18 phishing, 12 legitimate, about a third in Spanish) through the engine. "Flagged" means _Suspicious_ or _Likely phishing_.

| Metric    | Result |
| --------- | ------ |
| Precision | 94.4%  |
| Recall    | 94.4%  |
| F1        | 94.4%  |

17 of 18 phishing emails were caught, and 1 of 12 legitimate emails was a false alarm.

**Threshold sweep.** A cut-off of 25 gave the best balance (tied with 20). At 30 and above there were no false alarms, but 4 phishing emails slipped through. At 15 and below, false alarms tripled.

The test suite fails if precision or recall drops below 85%, so CI catches changes that make detection worse.

### Known mistakes

- **Missed:** a Spanish fake tax refund that asks for _datos bancarios_ (bank details) "before Friday". The content checks don't yet recognize requests for bank details, a weekday deadline isn't treated as urgency, and the fake tax agency isn't on the brand list.
- **False alarm:** a real newsletter whose links go through a click-tracking domain. Its link text shows the brand's site but points elsewhere, which is exactly what phishing does too. Lowering that flag's weight would hide real attacks, so this is a deliberate trade-off.

### An honest caveat

The same person wrote the checks and the sample emails, so these numbers are **optimistic**. They show the engine behaves as designed, not how it would perform on real-world mail. A fair evaluation would need a large, independently collected dataset.

## Run it locally

Requires Node.js 24 or newer.

```bash
git clone https://github.com/Barrientosgers/phishcheck.git
cd phishcheck
npm install
npm run dev        # http://localhost:5173/phishcheck/
```

| Command                | What it does                        |
| ---------------------- | ----------------------------------- |
| `npm test`             | Run all tests once (Vitest)         |
| `npm run accuracy`     | Print the accuracy report           |
| `npm run lint`         | ESLint                              |
| `npm run format:check` | Prettier                            |
| `npm run build`        | Type-check and build for production |

## Tech stack

TypeScript, React and Vite · postal-mime (email parsing) · tldts (domain parsing) · Vitest · ESLint and Prettier · GitHub Actions (CI on every push, then deploy to GitHub Pages)

The detection engine is loaded with a dynamic `import()`, so the page appears quickly and the engine downloads in the background.

## Roadmap

- [ ] Chrome extension (Manifest V3, WXT) reusing the same engine
- [ ] Detect requests for bank details, in English and Spanish
- [ ] A larger brand list and more sample emails

## License

[MIT](LICENSE) © 2026 Gerson Barrientos
