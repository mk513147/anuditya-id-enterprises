import { createContext } from 'react'

export interface QuoteContextValue {
  /** Open the quote dialog, optionally pre-selecting a service title. */
  openQuote: (serviceTitle?: string) => void
}

export const QuoteContext = createContext<QuoteContextValue | null>(null)
