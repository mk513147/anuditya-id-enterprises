import { useCallback, useMemo, useState, type ReactNode } from 'react'
import { QuoteDialog } from './QuoteDialog'
import { QuoteContext } from './quoteContext'

export function QuoteProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false)
  const [service, setService] = useState<string | undefined>()

  const openQuote = useCallback((serviceTitle?: string) => {
    setService(serviceTitle)
    setOpen(true)
  }, [])
  const value = useMemo(() => ({ openQuote }), [openQuote])

  return (
    <QuoteContext.Provider value={value}>
      {children}
      <QuoteDialog open={open} onOpenChange={setOpen} defaultService={service} />
    </QuoteContext.Provider>
  )
}
