import { ImageIcon } from 'lucide-react'
import { Link } from 'react-router-dom'
import { usePendingImageCounts } from '../hooks'

/** Schools with images submitted from the website that wait for the administrator's review. Hidden when there are none. */
export function PendingImagesBanner() {
  const { data } = usePendingImageCounts()
  if (!data?.length) return null
  const total = data.reduce((n, s) => n + s.count, 0)
  return (
    <section aria-label="Images awaiting review" className="mb-4 rounded-2xl border border-gold-400/50 bg-gold-100/40 p-4">
      <p className="flex items-center gap-2 text-sm font-bold text-navy-900">
        <ImageIcon className="size-4 shrink-0 text-gold-700" aria-hidden />
        {total} school image{total === 1 ? '' : 's'} submitted from the website {total === 1 ? 'is' : 'are'} awaiting your review
      </p>
      <ul className="mt-2 flex flex-wrap gap-2">
        {data.slice(0, 12).map((s) => (
          <li key={s.schoolId}>
            <Link to={`/admin/schools/${s.schoolId}`} className="inline-flex min-h-9 items-center rounded-full border bg-white px-3 text-sm font-medium text-navy-900 hover:border-royal-500 hover:text-royal-700">
              {s.schoolName} · {s.count}
            </Link>
          </li>
        ))}
      </ul>
    </section>
  )
}
