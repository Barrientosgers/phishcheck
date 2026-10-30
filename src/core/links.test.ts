import { describe, expect, it } from 'vitest'
import { decodeEntities, extractLinks } from './links'

describe('decodeEntities', () => {
  it('decodes named, decimal and hex entities', () => {
    expect(decodeEntities('a&amp;b &lt;x&gt; &quot;q&quot; &#65;&#x42;')).toBe('a&b <x> "q" AB')
  })

  it('leaves unknown or invalid entities untouched', () => {
    expect(decodeEntities('&bogus; &#0; &#x110000;')).toBe('&bogus; &#0; &#x110000;')
  })

  it('does not resolve names from the object prototype', () => {
    expect(decodeEntities('&constructor; &toString;')).toBe('&constructor; &toString;')
  })
})

describe('extractLinks', () => {
  it('returns visible text and the real href of an anchor', () => {
    const html = '<a href="http://evil.test/login">https://bank.example.com</a>'
    expect(extractLinks(html, '')).toEqual([
      { text: 'https://bank.example.com', href: 'http://evil.test/login', source: 'html' },
    ])
  })

  it('handles single quotes, unquoted values, nested tags and entities', () => {
    const html = `
      <A HREF='http://a.test/?x=1&amp;y=2'>Click <b>here</b></A>
      <a class="btn" href=http://b.test/path>B</a>`
    expect(extractLinks(html, '').map((l) => [l.text, l.href])).toEqual([
      ['Click here', 'http://a.test/?x=1&y=2'],
      ['B', 'http://b.test/path'],
    ])
  })

  it('does not treat data-href as href, and skips empty and fragment links', () => {
    const html =
      '<a data-href="http://x.test">x</a><a href="">empty</a><a href="#top">top</a><a>none</a>'
    expect(extractLinks(html, '')).toEqual([])
  })

  it('is not fooled by ">" inside a quoted attribute', () => {
    const html = '<a title="a > b" href="http://c.test/">C</a>'
    expect(extractLinks(html, '')[0].href).toBe('http://c.test/')
  })

  it('finds bare URLs in plain text and strips trailing punctuation', () => {
    const links = extractLinks('', 'Go to https://example.com/a, or (http://example.org/b).')
    expect(links.map((l) => l.href)).toEqual(['https://example.com/a', 'http://example.org/b'])
    expect(links.every((l) => l.source === 'text' && l.text === l.href)).toBe(true)
  })

  it('does not repeat a plain-text URL that the HTML already links to', () => {
    const html = '<a href="https://example.com/a">Open</a>'
    const links = extractLinks(html, 'Open https://example.com/a')
    expect(links).toHaveLength(1)
    expect(links[0].source).toBe('html')
  })

  it('keeps non-http schemes so later checks can judge them', () => {
    const links = extractLinks('<a href="javascript:alert(1)">x</a>', '')
    expect(links[0].href).toBe('javascript:alert(1)')
  })
})
