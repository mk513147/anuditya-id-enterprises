import { CtaBanner } from '@/components/shared/CtaBanner'
import { PageHero } from '@/components/shared/PageHero'
import { StudentSubmissionSection } from '@/features/students/components/StudentSubmissionSection'
import { usePageTitle } from '@/hooks/usePageTitle'
import { waMessages } from '@/lib/whatsapp'

export function StudentFormPage() {
  usePageTitle('Submit Student Form')
  return (
    <>
      <PageHero
        breadcrumb="Student Form"
        eyebrow="Student Information"
        title="Submit Student Form"
        description="Submit your student details securely for ID card preparation."
      />
      <StudentSubmissionSection />
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
