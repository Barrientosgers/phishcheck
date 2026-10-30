# PhishCheck

## Project

PhishCheck is a phishing email analyzer. It is a browser-only web app where a user pastes a raw email and gets an explainable phishing risk score (0-100), a verdict (Likely safe / Suspicious / Likely phishing), and a list of red flags, each with a plain-language explanation in English and Spanish. It is a public GitHub repo for a portfolio, hosted on GitHub Pages. Later, a Chrome extension will reuse the same detection engine.

## How we work (always follow these rules)

- Work step by step, one phase at a time. At the end of each phase, stop, summarize what changed, and wait for the user's approval before moving on.
- ALWAYS ask before any major change. Explain what you plan to do and why, then wait for a "yes". Major changes include: installing or removing packages, creating or deleting more than one file, changing the folder structure or architecture, editing config files, and any git commit or push.
- The user is here to learn. Briefly explain new concepts, libraries, and design decisions as we go, and point out anything worth mentioning in job interviews.
- Keep changes small and focused. Suggest a clear commit message after each meaningful step, and only commit or push after approval.
- If something is unclear, ask instead of guessing.

## Tech stack

- TypeScript, Vite, React
- postal-mime for parsing raw emails in the browser
- tldts for finding registrable domains correctly (handles co.uk and similar)
- Our own Levenshtein function for lookalike domain detection
- Vitest for tests, ESLint + Prettier for code quality
- GitHub Actions for CI and deploying to GitHub Pages
- Later: Chrome extension with Manifest V3 using WXT

Notes:

- TypeScript is pinned to ~6.0 because typescript-eslint does not yet support TypeScript 7. Upgrade once it does.
- Package manager: npm. License: MIT. GitHub repo name: `phishcheck` (Vite `base` must match it for GitHub Pages; set in Phase 8).
- postal-mime and tldts are installed in the phase that first uses them (1 and 3).

## Commands

- `npm run dev` start the dev server
- `npm run lint` ESLint
- `npm run typecheck` TypeScript project build check
- `npm run format` / `npm run format:check` Prettier
- `npm test` Vitest (single run); `npm run test:watch` for watch mode
- `npm run build` typecheck + production build

## Architecture

- `src/core/`: the detection engine. Pure TypeScript functions only: no UI code, no DOM, no network calls. The web app, the tests, and the future extension all share it. ESLint enforces this (no `window`, `document`, `fetch`, React imports, or imports from `ui/`).
- `src/ui/`: React components for the web app.
- `tests/fixtures/`: sample .eml files (phishing and legitimate). Use fictional brands (for example "Northwind Bank") and example.com addresses. Never use real personal data.

## Security and privacy rules

- All analysis runs locally in the browser. Never send email content to any server or API.
- Never open, fetch, or follow links or attachments found in emails.
- No secrets, tokens, or personal data in the repo.

## Detection checks (scope)

- Sender authentication: SPF, DKIM, DMARC results; From vs. Reply-To and Return-Path mismatches
- Domain tricks: lookalike domains, brand names in unofficial domains, display-name spoofing, unusual domain endings (.xyz, .top, etc.)
- Links: link text vs. real destination, raw IP addresses, URL shorteners, @ tricks in URLs, http instead of https, lookalike link domains
- Content (English and Spanish): urgency language, requests for passwords or card numbers, unusual payment requests (gift cards, wire transfers, crypto), generic greetings
- Attachments: risky file types (.exe, .html, .zip, macro-enabled Office files, etc.)
- Each check adds weighted points. The report lists every triggered flag with its explanation and points. The score is capped at 100.

## Phases

0. Project setup: Vite + React + TypeScript, ESLint, Prettier, Vitest, folder structure, .gitignore, and this CLAUDE.md
1. Email parser in core (headers, body, links, attachments) + tests
2. Sender and authentication checks + tests
3. Domain checks (tldts, Levenshtein, brand list) + tests
4. Link checks + tests
5. Content checks (English and Spanish) and the scoring system + tests
6. Web UI: paste box, sample email buttons, score, verdict, red flags list, sender table with SPF/DKIM/DMARC status, links table, and a note that the email never leaves the browser
7. Test fixtures and an accuracy script that reports precision and recall on phishing vs. legitimate samples
8. GitHub Actions: run lint and tests on every push, deploy to GitHub Pages
9. Polish: README with demo GIF, live link, how it works, safety notes, accuracy results, and a CI badge

Definition of done for each phase: tests pass, lint passes, and the user has reviewed and approved the changes.
