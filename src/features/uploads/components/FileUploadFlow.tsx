import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { useState } from 'react'
import type { FileUploadResult } from '@/types'
import { SchoolFileSubmissionForm } from './SchoolFileSubmissionForm'
import { UploadSuccess } from './UploadSuccess'

/**
 * The public submission workflow: form → (validate, upload, register) → confirmation. The form is unmounted after a
 * successful submission, so starting again always begins with an empty form (and nothing is kept in memory).
 */
export function FileUploadFlow() {
  const reduce = useReducedMotion()
  const [result, setResult] = useState<FileUploadResult | null>(null)
  const fade = reduce
    ? {}
    : { initial: { opacity: 0, y: 10 }, animate: { opacity: 1, y: 0 }, exit: { opacity: 0, y: -6 }, transition: { duration: 0.25 } }

  return (
    <AnimatePresence mode="wait" initial={false}>
      {result ? (
        <motion.div key="success" {...fade} className="rounded-[var(--radius-card)] border bg-white p-4 shadow-card sm:p-6">
          <UploadSuccess result={result} onReset={() => setResult(null)} />
        </motion.div>
      ) : (
        <motion.div key="form" {...fade}>
          <SchoolFileSubmissionForm onSubmitted={setResult} />
        </motion.div>
      )}
    </AnimatePresence>
  )
}
