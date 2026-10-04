import { FileCheck2, ImageIcon, Smartphone } from 'lucide-react'
import { useState } from 'react'
import { CtaBanner } from '@/components/shared/CtaBanner'
import { PageHero } from '@/components/shared/PageHero'
import { StudentForm } from '@/features/students/components/StudentForm'
import { StudentFormHelp } from '@/features/students/components/StudentFormHelp'
import { StudentFormSuccess } from '@/features/students/components/StudentFormSuccess'
import { PHOTO_MAX_BYTES } from '@/validations/student'
import { usePageTitle } from '@/hooks/usePageTitle'
import { waMessages } from '@/lib/whatsapp'
import type { StudentSubmissionResult } from '@/types'

const READY = [
  { icon: ImageIcon, text: `A clear student photo (JPG or PNG, up to ${PHOTO_MAX_BYTES / (1024 * 1024)} MB)` },
  { icon: FileCheck2, text: 'Admission number, class, section and roll number' },
  { icon: Smartphone, text: 'A parent or guardian mobile number' },
]

export function StudentFormPage() {
  usePageTitle('Submit Student Form')
  const [result, setResult] = useState<StudentSubmissionResult | null>(null)
  // Bumping the key remounts the form, which gives a clean reset for "Submit Another Form".
  const [formKey, setFormKey] = useState(0)

  return (
    <>
      <PageHero
        breadcrumb="Student Form"
        eyebrow="Student Information"
        title="Submit Student Form"
        description="Submit your student details securely for ID card preparation."
      />

      <div className="container-page py-8 sm:py-12">
        <section aria-labelledby="ready-title" className="mx-auto mb-6 max-w-6xl rounded-[var(--radius-card)] bg-royal-50 p-4 sm:mb-8 sm:p-5">
          <h2 id="ready-title" className="font-display text-base font-bold text-navy-900">Keep these ready</h2>
          <ul className="mt-3 grid gap-3 md:grid-cols-3">
            {READY.map(({ icon: Icon, text }) => (
              <li key={text} className="flex items-start gap-3 text-sm text-ink">
                <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-white text-royal-600 shadow-sm">
                  <Icon className="size-4" aria-hidden />
                </span>
                <span className="pt-1.5 leading-snug">{text}</span>
              </li>
            ))}
          </ul>
        </section>

        <div className="mx-auto grid max-w-6xl items-start gap-6 lg:grid-cols-[minmax(0,1fr)_20rem] lg:gap-8">
          <div className="min-w-0">
            {result ? (
              <StudentFormSuccess
                referenceNo={result.referenceNo}
                onReset={() => {
                  setResult(null)
                  setFormKey((k) => k + 1)
                }}
              />
            ) : (
              <StudentForm key={formKey} onSubmitted={setResult} />
            )}
          </div>
          <StudentFormHelp />
        </div>
      </div>

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
