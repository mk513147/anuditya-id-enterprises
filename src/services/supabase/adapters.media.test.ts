import { describe, expect, it } from 'vitest'
import { isRepositoryError } from '../errors'
import type { StudentPhotoResult } from '../types'
import { createFakeClient, type RecordedCall, type Responder } from './fakeClient'
import { createSupabaseRepositories } from './index'

const SCHOOL = 'd0000000-0000-4000-8000-000000000001'
const IMAGE = 'e0000000-0000-4000-8000-000000000001'
const jpeg = (name = 'Front gate.jpg', extra = 'x') => new File([new Uint8Array([0xff, 0xd8, 0xff, 0xe0]), extra], name, { type: 'image/jpeg' })
const rejection = async (p: Promise<unknown>) => p.then(() => null, (e: unknown) => e)
const opArgs = (c: RecordedCall, op: string) => c.ops.filter((o) => o.op === op).map((o) => o.args)
const setup = (responder?: Responder) => {
  const fake = createFakeClient(responder)
  return { ...fake, repos: createSupabaseRepositories(fake.client) }
}
const ROW = {
  id: IMAGE, school_id: SCHOOL, storage_path: `schools/${SCHOOL}/11111111-1111-4111-8111-111111111111.jpg`, original_name: 'Front gate.jpg',
  mime_type: 'image/jpeg', size_bytes: 5, alt_text: null, is_primary: true, display_order: 0, created_at: 'now',
}

describe('school images (Supabase)', () => {
  const happy: Responder = (c) => {
    if (c.target === 'admin_register_school_image') return { data: [{ image_id: IMAGE, is_primary: true, display_order: 0 }] }
    if (c.target === 'school_images') return { data: ROW }
    if (c.kind === 'signedUrl') return { data: { signedUrl: 'https://example.invalid/signed' } }
    return undefined
  }

  it('uploads into schools/<school id>/<random uuid>.<ext> without overwriting, then registers it with the checksum', async () => {
    const { repos, calls } = setup(happy)
    const img = await repos.schoolRepository.uploadImage(SCHOOL, jpeg(), { altText: ' Gate ' })
    const upload = calls.find((c) => c.kind === 'upload')!
    const { path, options } = upload.args as { path: string; options: { upsert: boolean; contentType: string } }
    expect(upload.target).toBe('school-images')
    expect(path).toMatch(new RegExp(`^schools/${SCHOOL}/[0-9a-f-]{36}\\.jpg$`))
    expect(path).not.toContain('gate')
    expect(options).toMatchObject({ upsert: false, contentType: 'image/jpeg' })
    const reg = calls.find((c) => c.target === 'admin_register_school_image')!
    expect(reg.args).toMatchObject({ p_school_id: SCHOOL, p_storage_path: path, p_original_name: 'Front gate.jpg', p_alt_text: 'Gate' })
    expect((reg.args as { p_sha256: string }).p_sha256).toMatch(/^[0-9a-f]{64}$/)
    expect(img).toMatchObject({ id: IMAGE, schoolId: SCHOOL, isPrimary: true, url: 'https://example.invalid/signed' })
    expect(JSON.stringify(img)).not.toContain('schools/') // the storage path never reaches the UI
    expect(calls.some((c) => c.kind === 'remove')).toBe(false)
  })

  it('refuses an invalid or disguised image before anything is sent', async () => {
    const { repos, calls } = setup(happy)
    for (const f of [new File(['<svg/>'], 'logo.svg', { type: 'image/svg+xml' }), new File(['<svg/>'], 'logo.jpg', { type: 'image/jpeg' }), new File([], 'e.jpg')]) {
      expect(isRepositoryError(await rejection(repos.schoolRepository.uploadImage(SCHOOL, f)), 'invalid_input'), f.name).toBe(true)
    }
    expect(isRepositoryError(await rejection(repos.schoolRepository.uploadImage('not-a-uuid', jpeg())), 'not_found')).toBe(true)
    expect(calls).toHaveLength(0)
  })

  it('a storage failure stops before registration', async () => {
    const { repos, calls } = setup((c) => (c.kind === 'upload' ? { error: { statusCode: '403', message: 'new row violates row-level security policy' } } : happy(c)))
    expect(isRepositoryError(await rejection(repos.schoolRepository.uploadImage(SCHOOL, jpeg())), 'permission_denied')).toBe(true)
    expect(calls.map((c) => c.kind)).toEqual(['upload'])
  })

  it.each([
    [{ code: 'P0001', message: 'duplicate_image' }, 'duplicate_image'],
    [{ code: '23505', message: 'duplicate key' }, 'duplicate_image'],
    [{ code: '22023', message: 'invalid_image' }, 'invalid_input'],
    [{ code: '42501', message: 'not_authorized' }, 'permission_denied'],
    [{ code: 'P0002', message: 'not_found' }, 'not_found'],
    [{ code: '', message: 'TypeError: Failed to fetch' }, 'network'],
  ] as const)('a registration failure (%j) removes the uploaded object again and reports %s', async (error, code) => {
    const { repos, calls } = setup((c) => (c.target === 'admin_register_school_image' ? { error } : happy(c)))
    expect(isRepositoryError(await rejection(repos.schoolRepository.uploadImage(SCHOOL, jpeg())), code)).toBe(true)
    const uploaded = (calls.find((c) => c.kind === 'upload')!.args as { path: string }).path
    const removed = calls.find((c) => c.kind === 'remove')!
    expect(removed.target).toBe('school-images')
    expect((removed.args as { paths: string[] }).paths).toEqual([uploaded]) // only the object this upload created
  })

  it('lists images with explicit columns and short-lived preview links, and never returns storage paths', async () => {
    const { repos, calls } = setup((c) => {
      if (c.kind === 'from') return { data: [ROW, { ...ROW, id: 'x', storage_path: `schools/${SCHOOL}/22222222-2222-4222-8222-222222222222.png`, is_primary: false, display_order: 1 }] }
      if (c.kind === 'signedUrls') return { data: (c.args as { paths: string[] }).paths.map((p, i) => ({ path: p, signedUrl: `https://example.invalid/${i}` })) }
      return undefined
    })
    const list = await repos.schoolRepository.listImages(SCHOOL)
    const q = calls.find((c) => c.kind === 'from')!
    expect(q.target).toBe('school_images')
    expect(opArgs(q, 'select')[0][0]).not.toContain('*')
    expect(opArgs(q, 'eq')).toContainEqual(['school_id', SCHOOL])
    const signed = calls.find((c) => c.kind === 'signedUrls')!.args as { expiresIn: number }
    expect(signed.expiresIn).toBeLessThanOrEqual(300)
    expect(list.map((i) => i.url)).toEqual(['https://example.invalid/0', 'https://example.invalid/1'])
    expect(JSON.stringify(list)).not.toContain('schools/')
  })

  it('changes the primary image through the administrator function', async () => {
    const { repos, calls } = setup(() => ({ data: [{ image_id: IMAGE, school_id: SCHOOL }] }))
    await repos.schoolRepository.setPrimaryImage(IMAGE)
    expect(calls[0]).toMatchObject({ kind: 'rpc', target: 'admin_set_primary_school_image', args: { p_image_id: IMAGE } })
    const denied = setup(() => ({ error: { code: '42501', message: 'not_authorized' } }))
    expect(isRepositoryError(await rejection(denied.repos.schoolRepository.setPrimaryImage(IMAGE)), 'permission_denied')).toBe(true)
  })
})

describe('public school image submissions (Supabase)', () => {
  const FIELDS = { schoolId: SCHOOL, contactPerson: 'Asha Teacher', contactDetails: '+91 98765 43210', note: ' Front gate ' }
  const open: Responder = (c) => {
    if (c.target === 'list_active_schools') return { data: [{ id: SCHOOL, name: 'Image School' }] }
    if (c.target === 'school_image_already_present') return { data: false }
    if (c.target === 'submit_school_image') return { data: [{ status: 'submitted' }] }
    return undefined
  }

  it('uploads to the content-named submissions/<school>/<sha256>.<ext> path without overwriting, then registers it as a submission', async () => {
    const { repos, calls } = setup(open)
    expect(await repos.schoolRepository.submitImage(FIELDS, jpeg())).toBe('submitted')
    const upload = calls.find((c) => c.kind === 'upload')!
    const { path, options } = upload.args as { path: string; options: { upsert: boolean } }
    expect(upload.target).toBe('school-images')
    expect(path).toMatch(new RegExp(`^submissions/${SCHOOL}/[0-9a-f]{64}\\.jpg$`))
    expect(options.upsert).toBe(false)
    const reg = calls.find((c) => c.target === 'submit_school_image')!
    expect(reg.args).toEqual({
      p_school_id: SCHOOL, p_contact_person: 'Asha Teacher', p_contact_details: '9876543210', p_storage_path: path,
      p_original_name: 'Front gate.jpg', p_sha256: path.slice(-68, -4), p_note: 'Front gate',
    })
    // Never an administrator function, never a delete.
    expect(calls.some((c) => c.kind === 'rpc' && c.target.startsWith('admin_'))).toBe(false)
    expect(calls.some((c) => c.kind === 'remove')).toBe(false)
  })

  it('skips the upload entirely when the school already has the image', async () => {
    const { repos, calls } = setup((c) => (c.target === 'school_image_already_present' ? { data: true } : open(c)))
    expect(await repos.schoolRepository.submitImage(FIELDS, jpeg())).toBe('already_present')
    expect(calls.some((c) => c.kind === 'upload' || c.target === 'submit_school_image')).toBe(false)
  })

  it('a retry that finds its own object already stored re-registers it (no second object, nothing removed)', async () => {
    const { repos, calls } = setup((c) =>
      c.kind === 'upload' ? { error: { statusCode: '409', error: 'Duplicate', message: 'The resource already exists' } } : c.target === 'submit_school_image' ? { data: [{ status: 'already_present' }] } : open(c),
    )
    expect(await repos.schoolRepository.submitImage(FIELDS, jpeg())).toBe('already_present')
    expect(calls.filter((c) => c.target === 'submit_school_image')).toHaveLength(1)
    expect(calls.some((c) => c.kind === 'remove')).toBe(false)
  })

  it.each([
    [{ code: '22023', message: 'invalid_image' }, 'invalid_input'],
    [{ code: 'P0001', message: 'image_not_uploaded' }, 'unknown'],
    [{ code: 'P0001', message: 'school_unavailable' }, 'school_unavailable'],
    [{ code: '', message: 'TypeError: Failed to fetch' }, 'network'],
  ] as const)('a registration failure (%j) reports %s and never deletes (visitors cannot)', async (error, code) => {
    const { repos, calls } = setup((c) => (c.target === 'submit_school_image' ? { error } : open(c)))
    const e = await rejection(repos.schoolRepository.submitImage(FIELDS, jpeg()))
    expect(isRepositoryError(e, code)).toBe(true)
    expect(String((e as Error).message)).not.toMatch(/submissions\/|[0-9a-f]{64}|P0001|22023/)
    expect(calls.some((c) => c.kind === 'remove')).toBe(false)
  })

  it('refuses invalid fields, invalid images and inactive schools before anything is uploaded', async () => {
    for (const [fields, file] of [
      [{ ...FIELDS, contactDetails: '123' }, jpeg()],
      [{ ...FIELDS, note: 'x'.repeat(501) }, jpeg()],
      [FIELDS, new File(['<svg/>'], 'logo.jpg', { type: 'image/jpeg' })],
    ] as const) {
      const { repos, calls } = setup(open)
      expect(isRepositoryError(await rejection(repos.schoolRepository.submitImage(fields, file)), 'invalid_input')).toBe(true)
      expect(calls).toHaveLength(0)
    }
    const { repos, calls } = setup((c) => (c.target === 'list_active_schools' ? { data: [] } : open(c)))
    expect(isRepositoryError(await rejection(repos.schoolRepository.submitImage(FIELDS, jpeg())), 'school_unavailable')).toBe(true)
    expect(calls.some((c) => c.kind === 'upload')).toBe(false)
  })

  it('the administrator reviews through admin_review_school_image; primary needs approval; pending counts are grouped', async () => {
    const { repos, calls } = setup(() => ({ data: [{ image_id: IMAGE, review_status: 'approved' }] }))
    await repos.schoolRepository.reviewImage(IMAGE, 'approved')
    expect(calls[0]).toMatchObject({ kind: 'rpc', target: 'admin_review_school_image', args: { p_image_id: IMAGE, p_decision: 'approved' } })
    const notApproved = setup(() => ({ error: { code: 'P0001', message: 'not_approved' } }))
    expect(isRepositoryError(await rejection(notApproved.repos.schoolRepository.setPrimaryImage(IMAGE)), 'invalid_status')).toBe(true)
    const counts = setup(() => ({ data: [{ school_id: 'a', school: { name: 'B school' } }, { school_id: 'c', school: { name: 'A school' } }, { school_id: 'c', school: { name: 'A school' } }] }))
    expect(await counts.repos.schoolRepository.pendingImageCounts()).toEqual([
      { schoolId: 'c', schoolName: 'A school', count: 2 },
      { schoolId: 'a', schoolName: 'B school', count: 1 },
    ])
    expect(opArgs(counts.calls[0], 'eq')).toContainEqual(['review_status', 'pending'])
  })
})

describe('student photos for the export (Supabase)', () => {
  const A = '11111111-1111-4111-8111-111111111111'
  const B = '22222222-2222-4222-8222-222222222222'
  const C = '33333333-3333-4333-8333-333333333333'
  const D = '44444444-4444-4444-8444-444444444444'
  const PATHS: Record<string, string | null> = { [A]: 'submissions/aaa.jpg', [B]: 'submissions/bbb.png', [C]: null, [D]: 'submissions/ddd.jpg' }

  it('reads each student\'s own photo path, downloads with the session (no signed URL), and reports every student', async () => {
    const { repos, calls } = setup((c) => {
      if (c.kind === 'from') return { data: (opArgs(c, 'in')[0][1] as string[]).map((id) => ({ id, photo_path: PATHS[id] ?? null })) }
      if (c.kind === 'download') {
        const path = (c.args as { path: string }).path
        if (path === 'submissions/ddd.jpg') return { error: { statusCode: '404', message: 'Object not found' } }
        return { data: new Blob([path]) }
      }
      return undefined
    })
    const got = new Map<string, StudentPhotoResult>()
    await repos.studentRepository.downloadPhotos([A, B, C, D, 'not-a-uuid'], { concurrency: 2, onPhoto: (id, r) => got.set(id, r) })
    expect(await (got.get(A) as { blob: Blob }).blob.text()).toBe('submissions/aaa.jpg') // A got A's object
    expect(await (got.get(B) as { blob: Blob }).blob.text()).toBe('submissions/bbb.png')
    expect(got.get(C)).toEqual({ status: 'missing' }) // no photo on record
    expect(got.get(D)).toEqual({ status: 'missing' }) // object gone from storage
    expect(got.get('not-a-uuid')).toEqual({ status: 'missing' })
    const q = calls.find((c) => c.kind === 'from')!
    expect(opArgs(q, 'select')[0][0]).toBe('id, photo_path')
    expect(calls.filter((c) => c.kind === 'download').every((c) => c.target === 'student-photos')).toBe(true)
    expect(calls.some((c) => c.kind === 'signedUrl' || c.kind === 'signedUrls')).toBe(false)
  })

  it('a failed download is "failed" (the student stays in the export), and record reads are chunked', async () => {
    const ids = Array.from({ length: 250 }, (_, i) => `${String(i).padStart(8, '0')}-0000-4000-8000-000000000000`)
    const { repos, calls } = setup((c) => {
      if (c.kind === 'from') return { data: (opArgs(c, 'in')[0][1] as string[]).map((id) => ({ id, photo_path: `submissions/${id}.jpg` })) }
      if (c.kind === 'download') return { error: { statusCode: '500', message: 'Internal error' } }
      return undefined
    })
    const got = new Map<string, StudentPhotoResult>()
    await repos.studentRepository.downloadPhotos(ids, { concurrency: 4, onPhoto: (id, r) => got.set(id, r) })
    expect(calls.filter((c) => c.kind === 'from').map((c) => (opArgs(c, 'in')[0][1] as string[]).length)).toEqual([100, 100, 50])
    expect(got.size).toBe(250)
    expect([...got.values()].every((r) => r.status === 'failed')).toBe(true)
  })

  it('an unauthorised caller gets an error, not an empty export', async () => {
    const { repos } = setup(() => ({ error: { code: '42501', message: 'permission denied for table students' } }))
    expect(isRepositoryError(await rejection(repos.studentRepository.downloadPhotos(['11111111-1111-4111-8111-111111111111'], { concurrency: 1, onPhoto: () => {} })), 'permission_denied')).toBe(true)
  })
})
