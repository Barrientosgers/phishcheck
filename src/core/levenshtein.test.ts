import { describe, expect, it } from 'vitest'
import { levenshtein } from './levenshtein'

describe('levenshtein', () => {
  it('is 0 for identical strings', () => {
    expect(levenshtein('northwind', 'northwind')).toBe(0)
    expect(levenshtein('', '')).toBe(0)
  })

  it('counts insertions, deletions and substitutions', () => {
    expect(levenshtein('northwind', 'northwlnd')).toBe(1) // substitution
    expect(levenshtein('northwind', 'northwin')).toBe(1) // deletion
    expect(levenshtein('northwind', 'northwinds')).toBe(1) // insertion
    expect(levenshtein('kitten', 'sitting')).toBe(3) // textbook example
  })

  it('handles an empty string on either side', () => {
    expect(levenshtein('', 'abc')).toBe(3)
    expect(levenshtein('abc', '')).toBe(3)
  })

  it('is symmetric', () => {
    expect(levenshtein('fabrikam', 'fabrlkam')).toBe(levenshtein('fabrlkam', 'fabrikam'))
  })
})
