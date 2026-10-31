export interface Brand {
  /** Name shown to users in explanations. */
  name: string
  /** Lowercase word that appears in the brand's domains and that impersonators imitate. */
  keyword: string
  /** Domains the brand really sends from. Subdomains of these are official too. */
  officialDomains: string[]
}

/**
 * Fictional brands, so the project never names a real company. A real deployment would need a
 * far larger list: these checks can only catch impersonation of brands that are listed here.
 */
export const BRANDS: readonly Brand[] = [
  { name: 'Northwind Bank', keyword: 'northwind', officialDomains: ['northwind.example.com'] },
  { name: 'Contoso Pay', keyword: 'contoso', officialDomains: ['contoso.example.com'] },
  { name: 'Fabrikam Cloud', keyword: 'fabrikam', officialDomains: ['fabrikam.example.com'] },
]
