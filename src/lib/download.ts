/**
 * Saves a Blob as a file in the browser. The data never leaves the device (a local object URL, not an upload), and the
 * object URL is revoked straight after the download starts so the data is not kept around.
 */
export function downloadBlob(filename: string, blob: Blob) {
  const url = URL.createObjectURL(blob)
  try {
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    a.rel = 'noopener'
    document.body.appendChild(a)
    a.click()
    a.remove()
  } finally {
    setTimeout(() => URL.revokeObjectURL(url), 0)
  }
}

/** Today's date in India (YYYY-MM-DD), for export file names. */
export const exportDate = (now = new Date()) => new Date(now.getTime() + 330 * 60_000).toISOString().slice(0, 10)
