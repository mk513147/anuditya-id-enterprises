import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { AlertTriangle, RefreshCw, Replace } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { WhatsAppButton } from '@/components/shared/WhatsAppButton'
import { Button } from '@/components/ui/button'
import { waMessages } from '@/lib/whatsapp'
import type { FileUploadResult } from '@/types'
import { FILE_INPUT_ACCEPT, validateUploadFile } from '@/validations/upload'
import { useUploadFile } from '../hooks'
import { FileDropzone } from './FileDropzone'
import { SelectedFileCard } from './SelectedFileCard'
import { UploadProgress } from './UploadProgress'
import { UploadSuccess } from './UploadSuccess'

const VALIDATION_ERROR_ID = 'upload-validation-error'
const HINT_ID = 'upload-hint'

/** Owns the whole upload workflow: pick → validate → upload (with progress) → success / error. */
export function FileUploadFlow() {
  const reduce = useReducedMotion()
  const inputRef = useRef<HTMLInputElement>(null)
  const progressRef = useRef<HTMLDivElement>(null)
  const inFlight = useRef(false) // synchronous guard: state is stale between two rapid clicks
  const errorHeadingRef = useRef<HTMLParagraphElement>(null)
  const [file, setFile] = useState<File | null>(null)
  const [validationError, setValidationError] = useState<string | null>(null)
  const [result, setResult] = useState<FileUploadResult | null>(null)
  const [focusDropzone, setFocusDropzone] = useState(false)
  const up = useUploadFile()

  // Keep keyboard / screen-reader focus on something meaningful as the UI changes under it.
  useEffect(() => {
    if (up.isPending) progressRef.current?.focus()
  }, [up.isPending])
  useEffect(() => {
    if (up.isError) errorHeadingRef.current?.focus()
  }, [up.isError])

  const openPicker = () => inputRef.current?.click()

  /** Single entry point for file picker and drag-and-drop. An invalid file is never stored. */
  const choose = (f: File | undefined) => {
    const error = validateUploadFile(f)
    if (inputRef.current) inputRef.current.value = '' // lets the same file be chosen again later
    if (error || !f) {
      setValidationError(error)
      return
    }
    setValidationError(null)
    setFile(f)
    up.reset()
  }

  const remove = () => {
    setFocusDropzone(true)
    setFile(null)
    setValidationError(null)
    up.reset()
  }

  const startUpload = async () => {
    const error = validateUploadFile(file)
    if (error || !file) {
      setValidationError(error)
      return
    }
    if (inFlight.current) return // guard against double submission
    inFlight.current = true
    try {
      setResult(await up.upload(file))
    } catch {
      // Surfaced through up.isError; the selected file stays so the user can retry.
    } finally {
      inFlight.current = false
    }
  }

  const reset = () => {
    setResult(null)
    remove()
  }

  const fade = reduce
    ? {}
    : { initial: { opacity: 0, y: 10 }, animate: { opacity: 1, y: 0 }, exit: { opacity: 0, y: -6 }, transition: { duration: 0.25 } }

  return (
    <div className="rounded-[var(--radius-card)] border bg-white p-4 shadow-card sm:p-6">
      <input
        ref={inputRef}
        id="upload-input"
        type="file"
        accept={FILE_INPUT_ACCEPT}
        aria-label="Choose a student data file (Excel or CSV)"
        className="sr-only"
        tabIndex={-1}
        onChange={(e) => choose(e.target.files?.[0])}
      />

      <AnimatePresence mode="wait" initial>
        {result ? (
          <motion.div key="success" {...fade}>
            <UploadSuccess result={result} onReset={reset} />
          </motion.div>
        ) : file ? (
          <motion.div key="file" {...fade}>
            <SelectedFileCard
              file={file}
              mode={up.isPending || up.isError ? 'busy' : 'ready'}
              onRemove={remove}
              onReplace={openPicker}
              onUpload={startUpload}
            />
            {up.isPending && <UploadProgress ref={progressRef} percent={up.progress} />}

            {up.isError && !up.isPending && (
              <div role="alert" className="mt-4 rounded-2xl border border-destructive/30 bg-red-50 p-4 sm:p-5">
                <p ref={errorHeadingRef} tabIndex={-1} className="flex items-start gap-2 font-semibold text-destructive outline-none">
                  <AlertTriangle className="mt-0.5 size-5 shrink-0" aria-hidden />
                  Something went wrong while uploading your file.
                </p>
                <p className="mt-1 text-sm text-ink">Your selected file is still here. Please try again, or choose another file.</p>
                <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
                  <Button type="button" variant="destructive" size="lg" onClick={startUpload}>
                    <RefreshCw aria-hidden /> Try Again
                  </Button>
                  <Button type="button" variant="outline" size="lg" onClick={openPicker}>
                    <Replace aria-hidden /> Choose Another File
                  </Button>
                  <WhatsAppButton size="lg" label="WhatsApp Us" message={waMessages.fileUploadHelp()} />
                </div>
              </div>
            )}

            {validationError && (
              <p id={VALIDATION_ERROR_ID} role="alert" className="mt-3 text-sm font-medium text-destructive">
                {validationError} Your previously selected file was kept.
              </p>
            )}
          </motion.div>
        ) : (
          <motion.div key="empty" {...fade}>
            <FileDropzone
              onBrowse={openPicker}
              onDropFile={choose}
              autoFocus={focusDropzone}
              invalid={!!validationError}
              describedBy={validationError ? `${HINT_ID} ${VALIDATION_ERROR_ID}` : HINT_ID}
            />
            <p id={HINT_ID} className="sr-only">
              Accepted file types are XLSX, XLS and CSV.
            </p>
            {validationError && (
              <p id={VALIDATION_ERROR_ID} role="alert" className="mt-3 text-center text-sm font-medium text-destructive sm:text-left">
                {validationError}
              </p>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
