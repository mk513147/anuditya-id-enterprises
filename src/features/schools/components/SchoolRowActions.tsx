import { Eye, Link2, Pencil, Power, PowerOff } from 'lucide-react'
import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import type { School } from '@/types'
import { copySchoolLink } from '../schoolActions'

interface Props {
  school: School
  /** table: compact icon buttons. card: labelled, touch-sized buttons. */
  context: 'table' | 'card'
  onEdit: (school: School) => void
  onToggle: (school: School) => void
}

export function SchoolRowActions({ school, context, onEdit, onToggle }: Props) {
  const ToggleIcon = school.isActive ? PowerOff : Power
  const toggleLabel = school.isActive ? 'Deactivate' : 'Activate'

  if (context === 'table') {
    const btn = 'size-9'
    return (
      <div className="flex justify-end gap-0.5">
        <Button asChild variant="ghost" size="icon" className={btn} title="View details">
          <Link to={`/admin/schools/${school.id}`} aria-label={`View ${school.name}`}>
            <Eye />
          </Link>
        </Button>
        <Button variant="ghost" size="icon" className={btn} title="Edit" aria-label={`Edit ${school.name}`} onClick={() => onEdit(school)}>
          <Pencil />
        </Button>
        <Button variant="ghost" size="icon" className={btn} title="Copy link" aria-label={`Copy link for ${school.name}`} onClick={() => void copySchoolLink(school.slug)}>
          <Link2 />
        </Button>
        <Button variant="ghost" size="icon" className={btn} title={toggleLabel} aria-label={`${toggleLabel} ${school.name}`} onClick={() => onToggle(school)}>
          <ToggleIcon className={school.isActive ? 'text-destructive' : 'text-emerald-700'} />
        </Button>
      </div>
    )
  }

  return (
    <div className="grid grid-cols-2 gap-2">
      <Button asChild variant="outline" className="h-11">
        <Link to={`/admin/schools/${school.id}`} aria-label={`View ${school.name}`}>
          <Eye /> View
        </Link>
      </Button>
      <Button variant="outline" className="h-11" aria-label={`Edit ${school.name}`} onClick={() => onEdit(school)}>
        <Pencil /> Edit
      </Button>
      <Button variant="outline" className="h-11" aria-label={`Copy link for ${school.name}`} onClick={() => void copySchoolLink(school.slug)}>
        <Link2 /> Copy link
      </Button>
      <Button variant="outline" className="h-11" aria-label={`${toggleLabel} ${school.name}`} onClick={() => onToggle(school)}>
        <ToggleIcon className={school.isActive ? 'text-destructive' : 'text-emerald-700'} /> {toggleLabel}
      </Button>
    </div>
  )
}
