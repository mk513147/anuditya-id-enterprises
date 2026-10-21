import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { RepositoryError, isRepositoryError } from '@/services/errors'
import { db } from '@/services/mock/db'
import { MOCK_IMAGE_FAILURE_TOKEN, mockSchoolRepository as repo } from '@/services/mock/schools'
import { checkImageFile, inspectImage, SCHOOL_IMAGE_MAX_BATCH, SCHOOL_IMAGE_MAX_BYTES, sniffImage } from '@/validations/schoolImage'
import { addToQueue, fileKey, runBatch, type QueueItem } from './imageBatch'

vi.mock('@/lib/delay', () => ({ delay: () => Promise.resolve() }))

const JPEG_HEAD = [0xff, 0xd8, 0xff, 0xe0]
const PNG_HEAD = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]
const WEBP_HEAD = [0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50]
const img = (name: string, head: number[], type = '', extra = 'x', lastModified = 1) =>
  new File([new Uint8Array(head), extra], name, { type, lastModified })
const rejection = async (p: Promise<unknown>) => p.then(() => null, (e: unknown) => e)

describe('school image validation', () => {
  it('recognises JPEG, PNG and WebP by their bytes', () => {
    expect(sniffImage(new Uint8Array(JPEG_HEAD))?.mime).toBe('image/jpeg')
    expect(sniffImage(new Uint8Array(PNG_HEAD))?.mime).toBe('image/png')
    expect(sniffImage(new Uint8Array(WEBP_HEAD))?.mime).toBe('image/webp')
    expect(sniffImage(new TextEncoder().encode('<svg xmlns='))).toBeNull()
  })

  it.each([
    ['photo.jpg', JPEG_HEAD, 'image/jpeg'],
    ['photo.JPEG', JPEG_HEAD, ''],
    ['hall.png', PNG_HEAD, 'image/png'],
    ['field.webp', WEBP_HEAD, 'image/webp'],
  ])('accepts %s and gives it a checksum', async (name, head, type) => {
    const r = await inspectImage(img(name, head, type))
    expect(r.ok).toBe(true)
    if (r.ok) expect(r.sha256).toMatch(/^[0-9a-f]{64}$/)
  })

  it.each([
    ['logo.svg', new TextEncoder().encode('<svg/>'), 'image/svg+xml', 'Only JPEG, PNG or WebP'],
    ['page.html', new TextEncoder().encode('<html>'), 'text/html', 'Only JPEG, PNG or WebP'],
    ['renamed.jpg', new Uint8Array(PNG_HEAD), 'image/jpeg', 'content does not match'],
    ['script.png', new TextEncoder().encode('<svg onload=alert(1)>'), 'image/png', 'content does not match'],
    ['gif.jpg', new TextEncoder().encode('GIF89a'), '', 'content does not match'],
    ['declared.png', new Uint8Array(PNG_HEAD), 'image/gif', 'Only JPEG, PNG or WebP'],
  ])('refuses %s', async (name, bytes, type, message) => {
    const r = await inspectImage(new File([bytes], name, { type }))
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.message).toContain(message)
  })

  it('refuses empty and oversized files before reading them', () => {
    expect(checkImageFile(new File([], 'empty.jpg'))).toMatch(/empty/)
    expect(checkImageFile(new File([new Uint8Array(SCHOOL_IMAGE_MAX_BYTES + 1)], 'big.jpg'))).toMatch(/5 MB/)
    expect(checkImageFile(new File([new Uint8Array(SCHOOL_IMAGE_MAX_BYTES)], 'max.jpg'))).toBeNull()
  })

  describe('with a browser image decoder', () => {
    const original = globalThis.createImageBitmap
    afterEach(() => {
      globalThis.createImageBitmap = original
    })
    it('refuses a corrupted image the browser cannot decode', async () => {
      globalThis.createImageBitmap = vi.fn().mockRejectedValue(new Error('decode failed')) as never
      const r = await inspectImage(img('broken.jpg', JPEG_HEAD, 'image/jpeg', 'garbage'))
      expect(r).toEqual({ ok: false, message: 'This image is damaged and cannot be opened.' })
    })
    it('accepts an image that decodes', async () => {
      globalThis.createImageBitmap = vi.fn().mockResolvedValue({ width: 10, height: 10, close: () => {} }) as never
      expect((await inspectImage(img('ok.jpg', JPEG_HEAD, 'image/jpeg'))).ok).toBe(true)
    })
  })

  it('the same bytes give the same checksum (used to refuse duplicates), different bytes a different one', async () => {
    const a = await inspectImage(img('a.jpg', JPEG_HEAD, '', 'same'))
    const b = await inspectImage(img('b.jpg', JPEG_HEAD, '', 'same'))
    const c = await inspectImage(img('c.jpg', JPEG_HEAD, '', 'other'))
    expect(a.ok && b.ok && a.sha256 === b.sha256).toBe(true)
    expect(a.ok && c.ok && a.sha256 !== c.sha256).toBe(true)
  })
})

describe('bulk upload queue', () => {
  it('queues many files at once, skips the same file chosen twice, and marks invalid files without uploading them', () => {
    const a = img('a.jpg', JPEG_HEAD), b = img('b.png', PNG_HEAD), bad = new File(['x'], 'x.svg', { type: 'image/svg+xml' })
    let r = addToQueue([], [a, b, bad])
    expect(r.queue.map((q) => q.status)).toEqual(['ready', 'ready', 'invalid'])
    r = addToQueue(r.queue, [a, img('c.webp', WEBP_HEAD)])
    expect(r.skippedDuplicates).toBe(1)
    expect(r.queue.map((q) => q.file.name)).toEqual(['a.jpg', 'b.png', 'x.svg', 'c.webp'])
    expect(fileKey(a)).not.toBe(fileKey(img('a.jpg', JPEG_HEAD, '', 'x', 2)))
  })

  it(`limits a batch to ${SCHOOL_IMAGE_MAX_BATCH} images`, () => {
    const files = Array.from({ length: SCHOOL_IMAGE_MAX_BATCH + 3 }, (_, i) => img(`p${i}.jpg`, JPEG_HEAD, '', 'x', i))
    const r = addToQueue([], files)
    expect(r.queue).toHaveLength(SCHOOL_IMAGE_MAX_BATCH)
    expect(r.overLimit).toBe(3)
  })

  it('reports each file on its own: a partial batch is never a whole success', async () => {
    const files = ['ok1.jpg', 'boom.jpg', 'dup.jpg', 'bad.jpg', 'ok2.jpg'].map((n, i) => img(n, JPEG_HEAD, '', 'x', i))
    const { queue } = addToQueue([], files)
    const state = new Map(queue.map((q) => [q.key, q]))
    const upload = async (f: File) => {
      if (f.name === 'boom.jpg') throw new TypeError('Failed to fetch')
      if (f.name === 'dup.jpg') throw new RepositoryError('duplicate_image', 'dup')
      if (f.name === 'bad.jpg') throw new RepositoryError('invalid_input', 'This image is damaged and cannot be opened.')
    }
    const tally = await runBatch(queue, upload, { onUpdate: (k, p) => state.set(k, { ...state.get(k)!, ...p }) })
    expect(tally).toEqual({ done: 2, failed: 1, duplicate: 1, invalid: 1 })
    expect([...state.values()].map((q) => `${q.file.name}:${q.status}`)).toEqual(['ok1.jpg:done', 'boom.jpg:failed', 'dup.jpg:duplicate', 'bad.jpg:invalid', 'ok2.jpg:done'])
    expect(state.get(queue[3].key)!.message).toBe('This image is damaged and cannot be opened.')
  })

  it('retry sends only the failed files, never ones already uploaded', async () => {
    const items: QueueItem[] = [
      { key: 'a', file: img('a.jpg', JPEG_HEAD), status: 'done' },
      { key: 'b', file: img('b.jpg', JPEG_HEAD), status: 'failed' },
      { key: 'c', file: img('c.jpg', JPEG_HEAD), status: 'duplicate' },
      { key: 'd', file: img('d.jpg', JPEG_HEAD), status: 'invalid' },
    ]
    const sent: string[] = []
    await runBatch(items, async (f) => void sent.push(f.name), { onUpdate: () => {} })
    expect(sent).toEqual(['b.jpg'])
  })

  it('uploads at most three at a time, and stops starting new ones when asked', async () => {
    const { queue } = addToQueue([], Array.from({ length: 9 }, (_, i) => img(`p${i}.jpg`, JPEG_HEAD, '', 'x', i)))
    let inFlight = 0, peak = 0
    const ctrl = new AbortController()
    const sent: string[] = []
    await runBatch(queue, async (f) => {
      inFlight++
      peak = Math.max(peak, inFlight)
      sent.push(f.name)
      if (sent.length === 4) ctrl.abort()
      await new Promise((r) => setTimeout(r, 2))
      inFlight--
    }, { onUpdate: () => {}, signal: ctrl.signal })
    expect(peak).toBeLessThanOrEqual(3)
    expect(sent.length).toBeLessThan(9) // the rest stay "waiting" and can be started later
  })
})

describe('demo repository: school images', () => {
  beforeEach(() => {
    db.schoolImages.length = 0
  })
  const school = () => db.schools[0].id

  it('the first image becomes primary; later ones are added after it and never replace it', async () => {
    const a = await repo.uploadImage(school(), img('a.jpg', JPEG_HEAD, '', '1'), { altText: '  Gate ' })
    const b = await repo.uploadImage(school(), img('b.png', PNG_HEAD, '', '2'))
    expect([a.isPrimary, a.displayOrder, a.altText]).toEqual([true, 0, 'Gate'])
    expect([b.isPrimary, b.displayOrder]).toEqual([false, 1])
    expect((await repo.listImages(school())).map((i) => i.originalName)).toEqual(['a.jpg', 'b.png'])
  })

  it('refuses the same image twice for a school, invalid files and unknown schools', async () => {
    await repo.uploadImage(school(), img('a.jpg', JPEG_HEAD, '', 'same'))
    expect(isRepositoryError(await rejection(repo.uploadImage(school(), img('copy.jpg', JPEG_HEAD, '', 'same'))), 'duplicate_image')).toBe(true)
    expect(isRepositoryError(await rejection(repo.uploadImage(school(), new File(['<svg/>'], 'x.svg'))), 'invalid_input')).toBe(true)
    expect(isRepositoryError(await rejection(repo.uploadImage('sch-nope', img('z.jpg', JPEG_HEAD))), 'not_found')).toBe(true)
    await expect(repo.uploadImage(school(), img(`net-${MOCK_IMAGE_FAILURE_TOKEN}.jpg`, JPEG_HEAD, '', 'n'))).rejects.toThrow()
    expect(db.schoolImages).toHaveLength(1)
  })

  it('changes the primary image without removing any image', async () => {
    await repo.uploadImage(school(), img('a.jpg', JPEG_HEAD, '', '1'))
    const b = await repo.uploadImage(school(), img('b.jpg', JPEG_HEAD, '', '2'))
    await repo.setPrimaryImage(b.id)
    const list = await repo.listImages(school())
    expect(list.map((i) => `${i.originalName}:${i.isPrimary}`)).toEqual(['b.jpg:true', 'a.jpg:false'])
    expect(isRepositoryError(await rejection(repo.setPrimaryImage(b.id)), 'no_change')).toBe(true)
    expect(JSON.stringify(list)).not.toMatch(/sha256/)
  })
})
