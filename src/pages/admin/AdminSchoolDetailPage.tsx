import { ArrowLeft, ClipboardList, ExternalLink, FolderOpen, Link2, Mail, MapPin, Pencil, Phone, Power, PowerOff, Users } from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { Link, useParams } from 'react-router-dom'
import { AdminCard } from '@/components/admin/AdminPageHeader'
import { ActiveBadge } from '@/components/admin/StatusBadge'
import { ErrorState, SkeletonBlock } from '@/components/shared/QueryState'
import { Button } from '@/components/ui/button'
import { SchoolFormDialog } from '@/features/schools/components/SchoolFormDialog'
import { SchoolStatusDialog } from '@/features/schools/components/SchoolStatusDialog'
import { useSchoolDetail } from '@/features/schools/hooks'
import { copySchoolLink } from '@/features/schools/schoolActions'
import { usePageTitle } from '@/hooks/usePageTitle'
import { formatDateTime } from '@/lib/format'
import { schoolLink } from '@/lib/schoolLinks'

function Info({ icon, label, children }: { icon: ReactNode; label: string; children: ReactNode }) {
  return (
    <div className="flex items-start gap-3">
      <span className="mt-0.5 grid size-9 shrink-0 place-items-center rounded-lg bg-royal-50 text-royal-600">{icon}</span>
      <div className="min-w-0">
        <dt className="text-xs font-medium text-muted-ink">{label}</dt>
        <dd className="break-words text-sm font-semibold text-navy-900">{children}</dd>
      </div>
    </div>
  )
}

export function AdminSchoolDetailPage() {
  const { schoolId = '' } = useParams()
  const { data, isPending, isError, refetch } = useSchoolDetail(schoolId)
  const [editOpen, setEditOpen] = useState(false)
  const [toggling, setToggling] = useState(false)
  usePageTitle(data ? `${data.school.name} – Admin` : 'School – Admin')

  const back = (
    <Button asChild variant="ghost" className="-ml-3 mb-4 h-11">
      <Link to="/admin/schools">
        <ArrowLeft aria-hidden /> All schools
      </Link>
    </Button>
  )

  if (isPending) {
    return (
      <>
        {back}
        <div className="space-y-4" aria-busy="true" aria-label="Loading school">
          <SkeletonBlock className="h-40" />
          <SkeletonBlock className="h-32" />
        </div>
      </>
    )
  }
  if (isError) {
    return (
      <>
        {back}
        <ErrorState message="This school could not be found or loaded." onRetry={() => void refetch()} />
      </>
    )
  }

  const { school, studentCount, orderCount, fileCount } = data
  const link = schoolLink(school.slug)
  const ToggleIcon = school.isActive ? PowerOff : Power

  return (
    <>
      {back}

      <AdminCard>
        <div className="flex flex-col gap-4 p-4 sm:flex-row sm:items-start sm:justify-between sm:p-6">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-3">
              <h2 className="text-2xl font-extrabold">{school.name}</h2>
              <ActiveBadge active={school.isActive} />
            </div>
            <p className="mt-1 text-sm text-muted-ink">
              Code <span className="font-mono font-semibold text-ink">{school.code}</span>
            </p>
          </div>
          <div className="grid grid-cols-2 gap-2 sm:flex">
            <Button variant="outline" className="h-11" onClick={() => setEditOpen(true)}>
              <Pencil aria-hidden /> Edit
            </Button>
            <Button variant="outline" className="h-11" onClick={() => setToggling(true)}>
              <ToggleIcon className={school.isActive ? 'text-destructive' : 'text-emerald-700'} aria-hidden />
              {school.isActive ? 'Deactivate' : 'Activate'}
            </Button>
          </div>
        </div>

        <dl className="grid gap-5 border-t p-4 sm:grid-cols-2 sm:p-6">
          <Info icon={<Users className="size-4" aria-hidden />} label="Contact person">{school.contactPerson}</Info>
          <Info icon={<Phone className="size-4" aria-hidden />} label="Phone">
            <a href={`tel:+91${school.phone}`} className="hover:underline">{school.phone}</a>
          </Info>
          <Info icon={<Mail className="size-4" aria-hidden />} label="Email">
            {school.email ? <a href={`mailto:${school.email}`} className="hover:underline">{school.email}</a> : <span className="font-normal text-muted-ink">Not provided</span>}
          </Info>
          <Info icon={<MapPin className="size-4" aria-hidden />} label="Address">
            {school.address ?? <span className="font-normal text-muted-ink">Not provided</span>}
          </Info>
        </dl>
        <p className="border-t px-4 py-3 text-xs text-muted-ink sm:px-6">
          Added {formatDateTime(school.createdAt)} · Last updated {formatDateTime(school.updatedAt)}
        </p>
      </AdminCard>

      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,22rem)]">
        <AdminCard title="Student submission link">
          <div className="space-y-4 p-4 sm:p-6">
            <div>
              <label htmlFor="school-link" className="mb-1.5 block text-sm font-medium">Public link</label>
              <input
                id="school-link"
                readOnly
                value={link}
                onFocus={(e) => e.currentTarget.select()}
                className="h-11 w-full rounded-md border border-input bg-surface px-3 font-mono text-sm outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
              />
            </div>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Button size="lg" onClick={() => void copySchoolLink(school.slug)}>
                <Link2 aria-hidden /> Copy link
              </Button>
              <Button asChild size="lg" variant="outline">
                <a href={link} target="_blank" rel="noopener noreferrer">
                  <ExternalLink aria-hidden /> Open link
                </a>
              </Button>
            </div>
            <p className="rounded-xl bg-gold-100 px-4 py-3 text-xs leading-relaxed text-navy-900">
              {school.isActive
                ? 'Anyone who has this link can open the school’s student form. It is a public link, not a private or password-protected portal.'
                : 'This school is inactive, so the link currently shows an “inactive” message and does not accept submissions.'}
            </p>
          </div>
        </AdminCard>

        <AdminCard title="Records for this school">
          <ul className="divide-y">
            {[
              { icon: Users, label: 'Students', value: studentCount },
              { icon: ClipboardList, label: 'Orders', value: orderCount },
              { icon: FolderOpen, label: 'Uploaded files', value: fileCount },
            ].map(({ icon: Icon, label, value }) => (
              <li key={label} className="flex items-center gap-3 px-4 py-4 sm:px-6">
                <span className="grid size-10 place-items-center rounded-xl bg-royal-50 text-royal-600">
                  <Icon className="size-5" aria-hidden />
                </span>
                <span className="flex-1 text-sm font-medium text-muted-ink">{label}</span>
                <span className="font-display text-2xl font-extrabold text-navy-900" data-testid={`count-${label}`}>{value}</span>
              </li>
            ))}
          </ul>
        </AdminCard>
      </div>

      <SchoolFormDialog open={editOpen} onOpenChange={setEditOpen} school={school} />
      <SchoolStatusDialog school={toggling ? school : null} onClose={() => setToggling(false)} />
    </>
  )
}
