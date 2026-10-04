import { useContext } from 'react'
import { QuoteContext } from './quoteContext'

export function useQuote() {
  const ctx = useContext(QuoteContext)
  if (!ctx) throw new Error('useQuote must be used inside <QuoteProvider>')
  return ctx
}
