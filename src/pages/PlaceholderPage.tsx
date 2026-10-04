import { Hammer } from 'lucide-react'
import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/button'

interface Props {
  title: string
  description?: string
}

/** Temporary stand-in for routes that are built in later phases. */
export function PlaceholderPage({ title, description = 'This page is being built in the next phase of the prototype.' }: Props) {
  return (
    <section className="container-page section-y">
      <div className="mx-auto flex max-w-xl flex-col items-center rounded-[var(--radius-card)] border bg-white p-8 text-center shadow-card sm:p-12">
        <span className="mb-5 grid size-14 place-items-center rounded-2xl bg-gold-100 text-gold-700">
          <Hammer className="size-7" aria-hidden />
        </span>
        <h1 className="text-2xl font-extrabold sm:text-3xl">{title}</h1>
        <p className="mt-3 text-muted-ink">{description}</p>
        <Button asChild className="mt-6">
          <Link to="/">Back to Home</Link>
        </Button>
      </div>
    </section>
  )
}
