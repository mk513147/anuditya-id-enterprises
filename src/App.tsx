import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { RouterProvider } from 'react-router-dom'
import { QuoteProvider } from '@/features/quote/QuoteProvider'
import { Toaster } from '@/components/ui/sonner'
import { router } from '@/router'

const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 60_000, refetchOnWindowFocus: false, retry: 1 } },
})

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <QuoteProvider>
        <RouterProvider router={router} />
      </QuoteProvider>
      <Toaster />
    </QueryClientProvider>
  )
}
