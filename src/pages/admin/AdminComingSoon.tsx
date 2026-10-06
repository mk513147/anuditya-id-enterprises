import { Hammer } from 'lucide-react'
import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/button'

/** Stand-in for admin sections built in later phases. The route and navigation already work. */
export function AdminComingSoon({ section }: { section: string }) {
  return (
    <div className="mx-auto mt-6 max-w-xl rounded-[var(--radius-card)] border bg-white p-8 text-center shadow-card sm:p-12">
      <span className="mx-auto grid size-14 place-items-center rounded-2xl bg-gold-100 text-gold-700">
        <Hammer className="size-7" aria-hidden />
      </span>
      <h2 className="mt-4 text-xl font-bold">{section} management is coming in a later phase</h2>
      <p className="mt-2 text-sm text-muted-ink">The navigation and route are in place. This section is not built yet.</p>
      <Button asChild className="mt-6">
        <Link to="/admin">Back to Dashboard</Link>
      </Button>
    </div>
  )
}
