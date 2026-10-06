import { LinkIcon, SearchX } from 'lucide-react'
import { Link, useParams } from 'react-router-dom'
import { CtaBanner } from '@/components/shared/CtaBanner'
import { PageHero } from '@/components/shared/PageHero'
import { ErrorState, SkeletonBlock } from '@/components/shared/QueryState'
import { WhatsAppButton } from '@/components/shared/WhatsAppButton'
import { Button } from '@/components/ui/button'
import { useResolveSchool } from '@/features/schools/hooks'
import { StudentSubmissionSection } from '@/features/students/components/StudentSubmissionSection'
import { usePageTitle } from '@/hooks/usePageTitle'
import { BUSINESS } from '@/lib/business'
import { waMessages } from '@/lib/whatsapp'

function Unavailable({ kind }: { kind: 'inactive' | 'not_found' }) {
  const inactive = kind === 'inactive'
  const Icon = inactive ? LinkIcon : SearchX
  return (
    <>
      <PageHero
        breadcrumb="School Form"
        eyebrow="Student Information"
        title={inactive ? 'This link is not active' : 'School link not found'}
        description={
          inactive
            ? 'Student submissions for this school are not being accepted through this link right now.'
            : 'We could not find a school for this link. It may have been typed incorrectly or changed.'
        }
      />
      <div className="container-page py-10 sm:py-14">
        <div role="status" className="mx-auto max-w-xl rounded-[var(--radius-card)] border bg-white p-6 text-center shadow-card sm:p-10">
          <span className="mx-auto grid size-14 place-items-center rounded-2xl bg-gold-100 text-gold-700">
            <Icon className="size-7" aria-hidden />
          </span>
          <h2 className="mt-4 text-xl font-bold">What you can do</h2>
          <p className="mt-2 text-sm leading-relaxed text-muted-ink">
            Please check the link you were given, or contact your school office or {BUSINESS.name} and we will help you.
          </p>
          <div className="mt-6 flex flex-col gap-3 min-[420px]:flex-row min-[420px]:justify-center">
            <WhatsAppButton size="lg" label="WhatsApp Us" message={waMessages.general()} />
            <Button asChild size="lg" variant="outline">
              <Link to="/student-form">Use the general student form</Link>
            </Button>
          </div>
        </div>
      </div>
    </>
  )
}

export function SchoolSubmissionPage() {
  const { schoolSlug = '' } = useParams()
  const { data, isPending, isError, refetch } = useResolveSchool(schoolSlug)
  usePageTitle(data?.status === 'active' ? `${data.school.name} – Student Form` : 'Student Form')

  if (isPending) {
    return (
      <div className="container-page py-10" aria-busy="true" aria-label="Loading school">
        <SkeletonBlock className="mb-6 h-40" />
        <SkeletonBlock className="mx-auto h-96 max-w-3xl" />
      </div>
    )
  }
  if (isError) {
    return (
      <div className="container-page py-14">
        <ErrorState message="We could not load this school's form." onRetry={() => void refetch()} />
      </div>
    )
  }
  if (data.status !== 'active') return <Unavailable kind={data.status} />

  const { school } = data
  return (
    <>
      <PageHero
        breadcrumb="School Form"
        eyebrow="Student Form"
        title={school.name}
        description="Submit your student details for ID card preparation."
      />
      <StudentSubmissionSection school={{ id: school.id, name: school.name }} />
      <CtaBanner
        title="Need help with the student form?"
        text="Call or message us and we will help you complete it."
        message={waMessages.general()}
        showQuote={false}
        showCall
      />
    </>
  )
}
