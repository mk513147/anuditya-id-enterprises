/**
 * Rules for school images, shared by the uploader UI and both repositories (the database and the `school-images` bucket
 * enforce the same limits again: JPEG / PNG / WebP, at most 5 MB). SVG is deliberately not accepted.
 */
export const SCHOOL_IMAGE_MAX_BYTES = 5 * 1024 * 1024
export const SCHOOL_IMAGE_MAX_BATCH = 20
export const SCHOOL_IMAGE_ACCEPT = '.jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp'

export type SchoolImageType = { mime: 'image/jpeg'; ext: 'jpg' } | { mime: 'image/png'; ext: 'png' } | { mime: 'image/webp'; ext: 'webp' }

const BY_EXT: Record<string, SchoolImageType> = {
  jpg: { mime: 'image/jpeg', ext: 'jpg' },
  jpeg: { mime: 'image/jpeg', ext: 'jpg' },
  png: { mime: 'image/png', ext: 'png' },
  webp: { mime: 'image/webp', ext: 'webp' },
}

/** The format the first bytes actually show (never the file name or the browser's guess). */
export function sniffImage(head: Uint8Array): SchoolImageType | null {
  const at = (sig: number[], offset = 0) => sig.every((v, i) => head[offset + i] === v)
  if (at([0xff, 0xd8, 0xff])) return BY_EXT.jpg
  if (at([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return BY_EXT.png
  if (at([0x52, 0x49, 0x46, 0x46]) && at([0x57, 0x45, 0x42, 0x50], 8)) return BY_EXT.webp
  return null
}

/** Quick checks that need no reading: extension, declared type and size. Returns an error message or null. */
export function checkImageFile(file: File): string | null {
  const ext = file.name.includes('.') ? file.name.slice(file.name.lastIndexOf('.') + 1).toLowerCase() : ''
  if (!BY_EXT[ext]) return 'Only JPEG, PNG or WebP images can be uploaded.'
  if (file.type && !['image/jpeg', 'image/png', 'image/webp'].includes(file.type.toLowerCase())) return 'Only JPEG, PNG or WebP images can be uploaded.'
  if (file.size === 0) return 'This file is empty.'
  if (file.size > SCHOOL_IMAGE_MAX_BYTES) return `Each image must be ${SCHOOL_IMAGE_MAX_BYTES / (1024 * 1024)} MB or smaller.`
  if (file.name.length > 255 || /[/\\<>]/.test(file.name)) return 'Please rename this file (the name is too long or has unusual characters).'
  return null
}

export type ImageCheck = { ok: true; type: SchoolImageType; sha256: string } | { ok: false; message: string }

/**
 * Full check: the quick checks, the file signature (it must be the format its extension says), a real decode where the
 * browser can do it (catches corrupted files), and the SHA-256 used to refuse the same image twice for a school.
 */
export async function inspectImage(file: File): Promise<ImageCheck> {
  const quick = checkImageFile(file)
  if (quick) return { ok: false, message: quick }
  let bytes: ArrayBuffer
  try {
    bytes = await file.arrayBuffer()
  } catch {
    return { ok: false, message: 'This file could not be read.' }
  }
  const type = sniffImage(new Uint8Array(bytes, 0, Math.min(16, bytes.byteLength)))
  const ext = file.name.slice(file.name.lastIndexOf('.') + 1).toLowerCase()
  if (!type || type.ext !== BY_EXT[ext].ext) return { ok: false, message: 'This file is not a valid JPEG, PNG or WebP image (its content does not match its name).' }
  if (typeof createImageBitmap === 'function') {
    try {
      const bitmap = await createImageBitmap(new Blob([bytes], { type: type.mime }))
      const empty = bitmap.width === 0 || bitmap.height === 0
      bitmap.close()
      if (empty) return { ok: false, message: 'This image is empty or damaged.' }
    } catch {
      return { ok: false, message: 'This image is damaged and cannot be opened.' }
    }
  }
  const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))
  return { ok: true, type, sha256: Array.from(digest, (b) => b.toString(16).padStart(2, '0')).join('') }
}
