import { ArchiveRestore, Archive, Eye, Pencil } from 'lucide-react'
import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import type { Student } from '@/types'

interface Props {
  student: Student
  /** table: compact icon buttons. card: labelled, touch-sized buttons. */
  context: 'table' | 'card'
  onEdit: (student: Student) => void
  onArchive: (student: Student) => void
  onRestore: (student: Student) => void
}

export function StudentRowActions({ student, context, onEdit, onArchive, onRestore }: Props) {
  const archived = student.isArchived
  const StatusIcon = archived ? ArchiveRestore : Archive
  const statusLabel = archived ? 'Restore' : 'Archive'
  const toggle = () => (archived ? onRestore(student) : onArchive(student))

  if (context === 'table') {
    const btn = 'size-9'
    return (
      <div className="flex justify-end gap-0.5">
        <Button asChild variant="ghost" size="icon" className={btn} title="View record">
          <Link to={`/admin/students/${student.id}`} aria-label={`View ${student.name}`}>
            <Eye />
          </Link>
        </Button>
        <Button variant="ghost" size="icon" className={btn} title="Edit" aria-label={`Edit ${student.name}`} onClick={() => onEdit(student)}>
          <Pencil />
        </Button>
        <Button variant="ghost" size="icon" className={btn} title={statusLabel} aria-label={`${statusLabel} ${student.name}`} onClick={toggle}>
          <StatusIcon className={archived ? 'text-emerald-700' : 'text-destructive'} />
        </Button>
      </div>
    )
  }

  return (
    <div className="grid grid-cols-3 gap-2">
      <Button asChild variant="outline" className="h-11 px-2">
        <Link to={`/admin/students/${student.id}`} aria-label={`View ${student.name}`}>
          <Eye /> View
        </Link>
      </Button>
      <Button variant="outline" className="h-11 px-2" aria-label={`Edit ${student.name}`} onClick={() => onEdit(student)}>
        <Pencil /> Edit
      </Button>
      <Button variant="outline" className="h-11 px-2" aria-label={`${statusLabel} ${student.name}`} onClick={toggle}>
        <StatusIcon className={archived ? 'text-emerald-700' : 'text-destructive'} /> {statusLabel}
      </Button>
    </div>
  )
}
