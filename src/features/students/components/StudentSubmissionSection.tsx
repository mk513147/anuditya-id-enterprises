import { FileCheck2, ImageIcon, Smartphone } from 'lucide-react'
import { useState } from 'react'
import type { School, StudentSubmissionResult } from '@/types'
import { PHOTO_MAX_BYTES } from '@/validations/student'
import { StudentForm } from './StudentForm'
import { StudentFormHelp } from './StudentFormHelp'
import { StudentFormSuccess } from './StudentFormSuccess'

const READY = [
  { icon: ImageIcon, text: `A clear student photo (JPG or PNG, up to ${PHOTO_MAX_BYTES / (1024 * 1024)} MB)` },
  { icon: FileCheck2, text: 'Admission number, class, section and roll number' },
  { icon: Smartphone, text: 'A parent or guardian mobile number' },
]

/**
 * The shared "keep these ready" strip + form/success + help panel.
 * Used by /student-form (school chosen from a dropdown) and /school/:slug (school fixed).
 */
export function StudentSubmissionSection({ school }: { school?: Pick<School, 'id' | 'name'> }) {
  const [result, setResult] = useState<StudentSubmissionResult | null>(null)
  // Bumping the key remounts the form, which gives a clean reset for "Submit Another Form".
  const [formKey, setFormKey] = useState(0)

  return (
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
              schoolName={result.schoolName}
              onReset={() => {
                setResult(null)
                setFormKey((k) => k + 1)
              }}
            />
          ) : (
            <StudentForm key={formKey} school={school} onSubmitted={setResult} />
          )}
        </div>
        <StudentFormHelp />
      </div>
    </div>
  )
}
