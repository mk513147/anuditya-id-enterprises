import type { Ref } from 'react'

interface Props {
  percent: number
  /** Receives focus when the upload starts so keyboard/screen-reader users are not left on a removed button. */
  ref?: Ref<HTMLDivElement>
}

export function UploadProgress({ percent, ref }: Props) {
  const value = Math.round(percent)
  return (
    <div ref={ref} tabIndex={-1} className="mt-4 rounded-2xl border bg-white p-4 outline-none sm:p-5">
      <div className="flex items-baseline justify-between gap-3">
        <p id="upload-progress-label" className="font-semibold text-navy-900">Uploading file…</p>
        <p className="font-display text-2xl font-extrabold tabular-nums text-royal-600" aria-hidden>
          {value}%
        </p>
      </div>
      <div
        role="progressbar"
        aria-labelledby="upload-progress-label"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={value}
        aria-valuetext={`${value} percent uploaded`}
        className="mt-3 h-3 overflow-hidden rounded-full bg-royal-100"
      >
        <div className="h-full rounded-full bg-gradient-to-r from-royal-600 to-royal-500 transition-[width] duration-200 ease-linear" style={{ width: `${value}%` }} />
      </div>
      <p className="mt-3 text-sm text-muted-ink">Please keep this page open until the upload finishes.</p>
    </div>
  )
}
