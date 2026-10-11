import { describe, expect, it } from 'vitest'
import { isRepositoryError, RepositoryError } from '../errors'
import { createFakeClient, type RecordedCall, type Responder } from './fakeClient'
import { createSupabaseRepositories } from './index'
import { fetchPage, ilikeAny, localDayBounds, searchTerm, toRepositoryError } from './shared'

const UUID = '11111111-1111-4111-8111-111111111111'
const UUID2 = '22222222-2222-4222-8222-222222222222'
const CODE = 'ABCDE-FGHJK-LMNPQ-RSTUV-WXYZ2'
const rejection = async (p: Promise<unknown>) => p.then(() => null, (e: unknown) => e)
const ops = (c: RecordedCall) => c.ops.map((o) => o.op)
const opArgs = (c: RecordedCall, op: string) => c.ops.filter((o) => o.op === op).map((o) => o.args)

const SUMMARY = {
  schools: { total: 5, active: 4 },
  students: { total: 20, notArchived: 18, archived: 2, pending: 3, approved: 14, rejected: 1 },
  studentSections: ['A', 'B'],
  orders: { total: 9, byStatus: { 'Order Received': 2, 'Data Verification': 1, Designing: 1, Printing: 1, 'Quality Check': 1, Ready: 1, Dispatched: 1, Delivered: 1 } },
  files: { total: 4, totalBytes: 1000, stored: 1, byType: { xlsx: 2, xls: 1, csv: 1 }, pendingReview: 2, byReview: { pending: 2, approved: 1, rejected: 0, corrections_required: 1 } },
  storage: { unregisteredUploads: 0 },
  services: { total: 3, enabled: 2, disabled: 1, byCategory: { 'id-cards': 1, 'school-materials': 1, 'design-printing': 1 } },
  advertisements: { total: 0, live: 0, scheduled: 0, ended: 0, hidden: 0, drafts: 0, disabled: 0 },
  feedback: { total: 6, pending: 2, approved: 3, rejected: 1 },
  recentSchools: [],
}

const STUDENT_ROW = {
  id: UUID, reference_no: 'ANU-2026-00001', school_id: UUID2, name: 'Test Student', father_name: 'F', mother_name: 'M', dob: '2012-01-01',
  class_name: 'Class 6', section: 'A', roll_no: '1', admission_no: 'ADM-1', address: '1 Sample Road, Demo Town', mobile: '9000000001',
  blood_group: null, house_name: null, house_colour: null, bus_route: null, bus_stoppage: null, submitted_at: '2026-10-01T10:00:00Z',
  updated_at: '2026-10-01T10:00:00Z', archived_at: null, approval_status: 'pending', reviewed_at: null, school: { name: 'S', code: 'S-1', is_active: true },
}

function setup(responder?: Responder) {
  const fake = createFakeClient(responder)
  return { ...fake, repos: createSupabaseRepositories(fake.client) }
}

describe('runtime safety: no client means a clear error, never demo data', () => {
  const repos = createSupabaseRepositories(null)
  const calls: [string, () => Promise<unknown>][] = [
    ['services.listPublic', () => repos.serviceRepository.listPublic()],
    ['ads.listPublic', () => repos.advertisementRepository.listPublic()],
    ['feedback.listApproved', () => repos.feedbackRepository.listApproved()],
    ['schools.listActive', () => repos.schoolRepository.listActive()],
    ['schools.resolveBySlug', () => repos.schoolRepository.resolveBySlug('x')],
    ['orders.track', () => repos.orderRepository.track('JOB-2026-0001', CODE)],
    ['students.list', () => repos.studentRepository.list()],
    ['files.list', () => repos.fileRepository.list()],
    ['dashboard.getCounts', () => repos.dashboardRepository.getCounts()],
  ]
  it.each(calls)('%s rejects with not_configured', async (_name, run) => {
    expect(isRepositoryError(await rejection(run()), 'not_configured')).toBe(true)
  })
})

describe('error mapping', () => {
  it.each([
    [{ code: '42501', message: 'permission denied for table students' }, 'permission_denied'],
    [{ code: 'PGRST301', message: 'JWT expired' }, 'permission_denied'],
    [{ message: 'not_authorized', code: '42501' }, 'permission_denied'],
    [{ code: 'P0002', message: 'not_found' }, 'not_found'],
    [{ code: 'PGRST116', message: 'no rows' }, 'not_found'],
    [{ code: '23514', message: 'new row violates check constraint "students_name_check"' }, 'invalid_input'],
    [{ code: 'P0001', message: 'school_unavailable' }, 'school_unavailable'],
    [{ code: 'P0001', message: 'no_change' }, 'no_change'],
    [{ code: '', message: 'TypeError: Failed to fetch' }, 'network'],
    [new TypeError('Failed to fetch'), 'network'],
    [{ code: 'XX000', message: 'internal' }, 'unknown'],
  ])('%j → %s', (raw, code) => {
    expect(toRepositoryError(raw).code).toBe(code)
  })

  it('never copies server text (which can echo submitted values) into the message', () => {
    const e = toRepositoryError({ code: '23505', message: 'duplicate key', details: 'Key (admission_no)=(SECRET-123) already exists.' })
    expect(e.message).not.toContain('SECRET-123')
    expect(e.message).not.toContain('duplicate key')
  })

  it('maps a unique violation to the caller-specific code', () => {
    expect(toRepositoryError({ code: '23505' }, { unique: 'duplicate_admission_no' }).code).toBe('duplicate_admission_no')
  })
})

describe('safe search and paging helpers', () => {
  it('strips PostgREST syntax and LIKE wildcards from search text', () => {
    expect(searchTerm('a,b(c)"d\\e:f%g_h*i')).toBe('a b c d e f g h i')
    expect(searchTerm("St. Mary's  JOB-2026/1 x@y")).toBe("St. Mary's JOB-2026/1 x@y")
    expect(searchTerm('%%%')).toBe('')
    expect(ilikeAny(['name', 'code'], 'st')).toBe('name.ilike."%st%",code.ilike."%st%"')
  })

  it('turns inclusive local days into [start, next day) bounds and rejects bad ranges', () => {
    const b = localDayBounds('2026-10-01', '2026-10-02')
    expect(new Date(b.lt!).getTime() - new Date(b.gte!).getTime()).toBe(2 * 86_400_000)
    expect(isRepositoryError(toRepositoryError((() => { try { localDayBounds('2026-10-05', '2026-10-01') } catch (e) { return e } })()), 'invalid_filter')).toBe(true)
    expect(() => localDayBounds('2026-02-30')).toThrow(RepositoryError)
  })

  it('clamps an out-of-range page to the last page', async () => {
    const seen: [number, number][] = []
    const page = await fetchPage<number>((from, to) => {
      seen.push([from, to])
      if (from >= 25) return Promise.resolve({ data: null, error: { code: 'PGRST103' }, count: null })
      return Promise.resolve({ data: [from], error: null, count: 25 })
    }, 9, 10)
    expect(page).toMatchObject({ page: 3, totalPages: 3, total: 25, items: [20] })
    expect(seen).toEqual([[80, 89], [0, 9], [20, 29]])
  })
})

describe('public operations use only the intended database functions', () => {
  it('order tracking needs both values, sends both, and returns only whitelisted fields', async () => {
    const { repos, calls } = setup((c) =>
      c.kind === 'rpc' ? { data: [{ order_no: 'JOB-2026-0001', customer_name: 'S', service: 'ID', quantity: 5, status: 'Printing', order_date: '2026-10-01', expected_delivery: '2026-10-09', internal_notes: 'leak?' }] } : undefined,
    )
    const r = await repos.orderRepository.track(' job 2026 0001 ', CODE)
    expect(calls).toHaveLength(1)
    expect(calls[0]).toMatchObject({ kind: 'rpc', target: 'track_order', args: { p_order_no: 'JOB-2026-0001', p_tracking_code: CODE } })
    expect(Object.keys(r!).sort()).toEqual(['customer', 'expectedDelivery', 'orderDate', 'orderNo', 'quantity', 'service', 'status'])
  })

  it('malformed input never reaches the server, and an empty answer is "not found"', async () => {
    const { repos, calls } = setup(() => ({ data: [] }))
    expect(await repos.orderRepository.track('JOB-2026-0001', '')).toBeNull()
    expect(await repos.orderRepository.track('', CODE)).toBeNull()
    expect(await repos.orderRepository.track("' OR 1=1", CODE)).toBeNull()
    expect(calls).toHaveLength(0)
    expect(await repos.orderRepository.track('JOB-2026-0001', CODE)).toBeNull()
    expect(calls).toHaveLength(1)
  })

  it('the public school dropdown gets id and name only, via list_active_schools', async () => {
    const { repos, calls } = setup(() => ({ data: [{ id: UUID, name: 'A School', phone: '9000000000' }] }))
    expect(await repos.schoolRepository.listActive()).toEqual([{ id: UUID, name: 'A School' }])
    expect(calls.map((c) => [c.kind, c.target])).toEqual([['rpc', 'list_active_schools']])
  })

  it('school links resolve through resolve_school; an inactive school carries no details', async () => {
    const { repos } = setup(() => ({ data: [{ status: 'inactive', school_id: null, name: null, slug: null }] }))
    expect(await repos.schoolRepository.resolveBySlug('x')).toEqual({ status: 'inactive' })
    const active = setup(() => ({ data: [{ status: 'active', school_id: UUID, name: 'A', slug: 'a-school' }] }))
    expect(await active.repos.schoolRepository.resolveBySlug('a-school')).toEqual({ status: 'active', school: { id: UUID, name: 'A', slug: 'a-school' } })
  })

  it('public content reads use only the public functions (never a table)', async () => {
    const { repos, calls } = setup(() => ({ data: [] }))
    await repos.serviceRepository.listPublic()
    await repos.advertisementRepository.listPublic()
    await repos.feedbackRepository.listApproved()
    expect(calls.map((c) => [c.kind, c.target])).toEqual([
      ['rpc', 'list_enabled_services'],
      ['rpc', 'list_published_advertisements'],
      ['rpc', 'list_approved_feedback'],
    ])
  })

  it('feedback is submitted through submit_feedback and is always pending', async () => {
    const { repos, calls } = setup(() => ({ data: [{ id: UUID, status: 'pending' }] }))
    expect(await repos.feedbackRepository.submit({ name: ' A ', rating: 5, message: ' Very good work ', organization: '' })).toEqual({ id: UUID, status: 'pending' })
    expect(calls[0]).toMatchObject({ kind: 'rpc', target: 'submit_feedback', args: { p_name: 'A', p_organization: null, p_rating: 5, p_message: 'Very good work' } })
    expect(isRepositoryError(await rejection(repos.feedbackRepository.submit({ name: 'A', rating: 9 as never, message: 'x' })), 'invalid_input')).toBe(true)
  })
})

describe('student submission and photo storage', () => {
  const photo = new File([new Uint8Array([1, 2, 3])], 'my child.JPG', { type: 'image/jpeg' })
  const submission = {
    schoolId: UUID2, name: 'Test Student', fatherName: 'F', motherName: 'M', dob: '2012-01-01', className: 'Class 6', section: 'A', rollNo: '1',
    admissionNo: 'ADM-1', address: '1 Sample Road, Demo Town', mobile: '9000000001', photo,
  }

  it('uploads the photo privately under a random name, then submits through submit_student with that path', async () => {
    const { repos, calls } = setup((c) => (c.kind === 'rpc' ? { data: [{ reference_no: 'ANU-2026-00009', submitted_at: 'now', school_name: 'S' }] } : undefined))
    expect(await repos.studentRepository.submit(submission)).toEqual({ referenceNo: 'ANU-2026-00009', submittedAt: 'now', schoolName: 'S' })
    const [upload, rpc] = calls
    expect(upload.kind).toBe('upload')
    expect(upload.target).toBe('student-photos')
    const { path, options } = upload.args as { path: string; options: { upsert: boolean; contentType: string } }
    expect(path).toMatch(/^submissions\/[0-9a-f-]{36}\.jpg$/)
    expect(path).not.toContain('child')
    expect(options).toMatchObject({ upsert: false, contentType: 'image/jpeg' })
    expect(rpc).toMatchObject({ kind: 'rpc', target: 'submit_student' })
    expect((rpc.args as Record<string, unknown>).p_photo_path).toBe(path)
    expect(Object.keys(rpc.args as object)).not.toContain('p_approval_status') // the browser cannot choose the review state
  })

  it('a failed upload stops before anything is submitted', async () => {
    const { repos, calls } = setup((c) => (c.kind === 'upload' ? { error: { statusCode: '403', message: 'new row violates row-level security policy' } } : undefined))
    expect(isRepositoryError(await rejection(repos.studentRepository.submit(submission)), 'permission_denied')).toBe(true)
    expect(calls.map((c) => c.kind)).toEqual(['upload'])
  })

  it('maps the database refusing a photo or a closed school', async () => {
    const closed = setup((c) => (c.kind === 'rpc' ? { error: { code: 'P0001', message: 'school_unavailable' } } : undefined))
    expect(isRepositoryError(await rejection(closed.repos.studentRepository.submit(submission)), 'school_unavailable')).toBe(true)
    const badPhoto = setup((c) => (c.kind === 'rpc' ? { error: { code: '22023', message: 'invalid_photo' } } : undefined))
    expect(isRepositoryError(await rejection(badPhoto.repos.studentRepository.submit(submission)), 'invalid_input')).toBe(true)
  })

  it('the detail page gets the photo as a short-lived signed link, created on demand', async () => {
    const { repos, calls } = setup((c) => {
      if (c.kind === 'from' && c.target === 'students') return { data: { ...STUDENT_ROW, photo_path: 'submissions/x.jpg' } }
      if (c.kind === 'from' && c.target === 'orders') return { data: [] }
      if (c.kind === 'signedUrl') return { data: { signedUrl: 'https://example.invalid/signed' } }
      return undefined
    })
    const { student } = await repos.studentRepository.getDetail(UUID)
    expect(student.photoUrl).toBe('https://example.invalid/signed')
    const signed = calls.find((c) => c.kind === 'signedUrl')!
    expect(signed.target).toBe('student-photos')
    expect((signed.args as { expiresIn: number }).expiresIn).toBeLessThanOrEqual(300)
    expect(JSON.stringify(student)).not.toContain('submissions/x.jpg') // the storage path itself is not exposed
  })
})

describe('admin lists: explicit columns, filters and pagination', () => {
  it('students: filters, safe search, range paging and counts from admin_summary', async () => {
    const { repos, calls } = setup((c) => (c.kind === 'rpc' ? { data: SUMMARY } : { data: [STUDENT_ROW], count: 31 }))
    const r = await repos.studentRepository.list({ search: 'ab,c(', approval: 'pending', schoolId: UUID2, section: 'a', page: 2, pageSize: 10 })
    const q = calls.find((c) => c.kind === 'from')!
    expect(q.target).toBe('students')
    const select = opArgs(q, 'select')[0]
    expect(select[0]).not.toContain('*')
    expect(select[0]).not.toContain('photo_path')
    expect(select[1]).toEqual({ count: 'exact' })
    expect(opArgs(q, 'is')).toContainEqual(['archived_at', null])
    expect(opArgs(q, 'eq')).toEqual(expect.arrayContaining([['approval_status', 'pending'], ['school_id', UUID2], ['section', 'A']]))
    expect(opArgs(q, 'or')[0][0]).toBe('name.ilike."%ab c%",reference_no.ilike."%ab c%",admission_no.ilike."%ab c%",roll_no.ilike."%ab c%"')
    expect(opArgs(q, 'range')[0]).toEqual([10, 19])
    expect(r).toMatchObject({ page: 2, total: 31, totalPages: 4, counts: { active: 18, archived: 2, pending: 3, approved: 14, rejected: 1 } })
    expect(r.items[0]).toMatchObject({ id: UUID, approvalStatus: 'pending', schoolName: 'S', schoolActive: true })
  })

  it('students: rejects an unknown review filter before any request', async () => {
    const { repos, calls } = setup()
    expect(isRepositoryError(await rejection(repos.studentRepository.list({ approval: 'maybe' as never })), 'invalid_filter')).toBe(true)
    expect(calls).toHaveLength(0)
  })

  it('students: review goes through admin_review_student', async () => {
    const { repos, calls } = setup((c) => (c.kind === 'rpc' ? { data: [{ id: UUID, approval_status: 'approved', reviewed_at: 'now' }] } : { data: { ...STUDENT_ROW, approval_status: 'approved', reviewed_at: 'now' } }))
    expect((await repos.studentRepository.review(UUID, 'approved')).approvalStatus).toBe('approved')
    expect(calls[0]).toMatchObject({ kind: 'rpc', target: 'admin_review_student', args: { p_student_id: UUID, p_decision: 'approved' } })
    expect(isRepositoryError(await rejection(repos.studentRepository.review(UUID, 'maybe' as never)), 'invalid_status')).toBe(true)
    expect(isRepositoryError(await rejection(repos.studentRepository.review('', 'approved')), 'invalid_id')).toBe(true)
  })

  it('students: export pages through every match up to the cap, without the page filter', async () => {
    let served = 0
    const { repos, calls } = setup(() => {
      const n = Math.min(1000, 2500 - served)
      served += n
      return { data: Array.from({ length: n }, () => STUDENT_ROW) }
    })
    const r = await repos.studentRepository.exportRows({ page: 3, pageSize: 10 })
    expect(r.rows).toHaveLength(2500)
    expect(r.truncated).toBe(false)
    expect(calls.map((c) => opArgs(c, 'range')[0])).toEqual([[0, 999], [1000, 1999], [2000, 2999]])
  })

  it('students: an archived/approval update maps a duplicate admission number', async () => {
    const { repos } = setup(() => ({ error: { code: '23505' } }))
    expect(isRepositoryError(await rejection(repos.studentRepository.setArchived(UUID, false)), 'duplicate_admission_no')).toBe(true)
  })

  it('orders: never select the tracking hash; search covers number and customer', async () => {
    const { repos, calls } = setup((c) => (c.kind === 'rpc' ? { data: SUMMARY } : { data: [], count: 0 }))
    const r = await repos.orderRepository.list({ search: 'job 2026', status: 'Printing', from: '2026-10-01' })
    const q = calls.find((c) => c.kind === 'from')!
    expect(opArgs(q, 'select')[0][0]).not.toMatch(/tracking|\*/)
    expect(opArgs(q, 'eq')).toContainEqual(['status', 'Printing'])
    expect(opArgs(q, 'gte')).toContainEqual(['order_date', '2026-10-01'])
    expect(opArgs(q, 'or')[0][0]).toContain('customer_name.ilike."%job 2026%"')
    expect(opArgs(q, 'or')[0][0]).toContain('order_no.ilike."%JOB-2026%"')
    expect(r.counts.byStatus.Printing).toBe(1)
  })

  it('orders: create and rotate go through the administrator functions and return the code once', async () => {
    const order = { id: UUID, order_no: 'JOB-2026-0010', school_id: null, customer_name: 'C', service: 'ID', quantity: 1, status: 'Order Received', order_date: '2026-10-01', expected_delivery: '2026-10-02', internal_notes: null, updated_at: 'now', school: null }
    const { repos, calls } = setup((c) => {
      if (c.kind === 'rpc' && c.target === 'admin_create_order') return { data: [{ order_id: UUID, order_no: 'JOB-2026-0010', tracking_code: 'abcdefghjklmnpqrstuvwxyz2' }] }
      if (c.kind === 'rpc' && c.target === 'admin_rotate_tracking_code') return { data: 'ZZZZZYYYYYXXXXXWWWWWVVVVV' }
      if (c.target === 'orders') return { data: order }
      return { data: [] }
    })
    const created = await repos.orderRepository.create({ customer: 'C', service: 'ID', quantity: 1, orderDate: '2026-10-01', expectedDelivery: '2026-10-02' })
    expect(created.trackingCode).toBe('ABCDE-FGHJK-LMNPQ-RSTUV-WXYZ2')
    expect(JSON.stringify(created.order)).not.toMatch(/ABCDE|tracking/i)
    expect(calls[0]).toMatchObject({ target: 'admin_create_order', args: { p_school_id: null, p_customer_name: 'C', p_quantity: 1 } })
    expect(await repos.orderRepository.rotateTrackingCode(UUID)).toBe('ZZZZZ-YYYYY-XXXXX-WWWWW-VVVVV')
    const invalid = await rejection(repos.orderRepository.create({ service: '', quantity: 0, orderDate: 'x', expectedDelivery: 'y' }))
    expect(isRepositoryError(invalid, 'invalid_input')).toBe(true)
  })

  it('orders: a status change uses admin_set_order_status and maps no_change', async () => {
    const { repos } = setup((c) => (c.kind === 'rpc' ? { error: { code: 'P0001', message: 'no_change' } } : undefined))
    expect(isRepositoryError(await rejection(repos.orderRepository.updateStatus(UUID, 'Printing')), 'no_change')).toBe(true)
    expect(isRepositoryError(await rejection(repos.orderRepository.updateStatus(UUID, 'Cancelled' as never)), 'invalid_status')).toBe(true)
  })

  it('a non-uuid id is "not found" without a request', async () => {
    const { repos, calls } = setup()
    expect(isRepositoryError(await rejection(repos.orderRepository.getDetail('ord-1')), 'not_found')).toBe(true)
    expect(isRepositoryError(await rejection(repos.studentRepository.getDetail('stu-1')), 'not_found')).toBe(true)
    expect(calls).toHaveLength(0)
  })

  it('an expired session surfaces as permission_denied, not as an empty list', async () => {
    const { repos } = setup(() => ({ error: { code: '42501', message: 'permission denied for table orders' } }))
    expect(isRepositoryError(await rejection(repos.orderRepository.list()), 'permission_denied')).toBe(true)
  })
})

describe('files: school data submissions in private storage', () => {
  const SUBMISSION = {
    schoolId: UUID2, contactPerson: ' Asha Teacher ', contactDetails: '+91 98765 43210', category: 'student_data' as const,
    description: 'Student list for the 2026-27 session, Class 10, for ID card printing.',
  }
  const REGISTERED = { reference_no: 'FILE-2026-00009', original_name: 'Class 9.csv', file_type: 'csv', size_bytes: 3, uploaded_at: 'now', school_name: 'S' }
  const csv = (name = 'Class 9.csv') => new File(['a,b'], name, { type: '' })
  /** Active-school list contains the school; registration succeeds. */
  const happy: Responder = (c) =>
    c.target === 'list_active_schools' ? { data: [{ id: UUID2, name: 'S' }] } : c.target === 'submit_school_file' ? { data: [REGISTERED] } : undefined

  it('checks the school, uploads into incoming/<uuid>.<ext> with the bucket MIME type, then registers through submit_school_file', async () => {
    const progress: number[] = []
    const { repos, calls } = setup(happy)
    expect(await repos.fileRepository.submit({ ...SUBMISSION, file: csv(), instructions: '  ' }, { onProgress: (p) => progress.push(p) })).toEqual({
      referenceNo: 'FILE-2026-00009', originalName: 'Class 9.csv', type: 'csv', sizeBytes: 3, uploadedAt: 'now', schoolName: 'S',
    })
    expect(calls.map((c) => `${c.kind}:${c.target}`)).toEqual(['rpc:list_active_schools', 'upload:school-uploads', 'rpc:submit_school_file'])
    const upload = calls[1].args as { path: string; options: { contentType: string; upsert: boolean } }
    expect(upload.path).toMatch(/^incoming\/[0-9a-f-]{36}\.csv$/)
    expect(upload.path).not.toContain('Class')
    expect(upload.options).toMatchObject({ contentType: 'text/csv', upsert: false })
    expect(calls[2].args).toEqual({
      p_school_id: UUID2, p_contact_person: 'Asha Teacher', p_contact_details: '9876543210', p_category: 'student_data',
      p_description: SUBMISSION.description, p_storage_path: upload.path, p_original_name: 'Class 9.csv', p_instructions: null,
    })
    expect(Object.keys(calls[2].args as object).some((k) => /status|review|notes|bucket/.test(k))).toBe(false) // the browser cannot choose the review state
    expect(progress.at(-1)).toBe(100)
  })

  it('refuses invalid fields or a disallowed file before any request', async () => {
    const { repos, calls } = setup(happy)
    const exe = new File(['MZ'], 'virus.exe', { type: 'application/x-msdownload' })
    let e = await rejection(repos.fileRepository.submit({ ...SUBMISSION, file: exe }, { onProgress: () => {} }))
    expect(isRepositoryError(e, 'invalid_input')).toBe(true)
    expect((e as RepositoryError).fieldErrors).toHaveProperty('file')
    e = await rejection(repos.fileRepository.submit({ ...SUBMISSION, contactDetails: 'nope', file: csv() }, { onProgress: () => {} }))
    expect((e as RepositoryError).fieldErrors).toHaveProperty('contactDetails')
    e = await rejection(repos.fileRepository.submit({ ...SUBMISSION, file: new File(['not a zip'], 'fake.xlsx') }, { onProgress: () => {} }))
    expect((e as RepositoryError).fieldErrors).toHaveProperty('file')
    expect(calls).toHaveLength(0)
  })

  it('an inactive school is refused before anything is uploaded', async () => {
    const { repos, calls } = setup((c) => (c.target === 'list_active_schools' ? { data: [] } : undefined))
    expect(isRepositoryError(await rejection(repos.fileRepository.submit({ ...SUBMISSION, file: csv() }, { onProgress: () => {} })), 'school_unavailable')).toBe(true)
    expect(calls.map((c) => c.kind)).toEqual(['rpc'])
  })

  it('a storage failure stops before registration and is never reported as success', async () => {
    const { repos, calls } = setup((c) => (c.kind === 'upload' ? { error: { statusCode: '413', message: 'Payload too large' } } : happy(c)))
    expect(await rejection(repos.fileRepository.submit({ ...SUBMISSION, file: csv() }, { onProgress: () => {} }))).toBeInstanceOf(RepositoryError)
    expect(calls.some((c) => c.target === 'submit_school_file')).toBe(false)
  })

  it('a registration failure after upload is an error; a retry re-registers the SAME object instead of uploading again', async () => {
    let fail = true
    const { repos, calls } = setup((c) => {
      if (c.target === 'submit_school_file' && fail) return { error: { code: '', message: 'TypeError: Failed to fetch' } }
      return happy(c)
    })
    const file = csv()
    expect(isRepositoryError(await rejection(repos.fileRepository.submit({ ...SUBMISSION, file }, { onProgress: () => {} })), 'network')).toBe(true)
    fail = false
    await repos.fileRepository.submit({ ...SUBMISSION, file }, { onProgress: () => {} })
    const uploads = calls.filter((c) => c.kind === 'upload')
    const registrations = calls.filter((c) => c.target === 'submit_school_file').map((c) => (c.args as { p_storage_path: string }).p_storage_path)
    expect(uploads).toHaveLength(1) // anonymous visitors cannot delete objects, so a retry must not leave a second copy
    expect(registrations).toEqual([(uploads[0].args as { path: string }).path, (uploads[0].args as { path: string }).path])
    // No cleanup is attempted from the browser: there is no delete call at all.
    expect(calls.some((c) => c.ops.some((o) => /remove|delete/i.test(o.op)))).toBe(false)
  })

  it('maps database refusals: closed school, invalid input, unconfirmed upload', async () => {
    for (const [error, code] of [
      [{ code: 'P0001', message: 'school_unavailable' }, 'school_unavailable'],
      [{ code: '22023', message: 'invalid_input' }, 'invalid_input'],
      [{ code: '22023', message: 'invalid_file' }, 'invalid_input'],
      [{ code: 'P0001', message: 'file_not_uploaded' }, 'unknown'],
      [{ code: '42501', message: 'permission denied for function submit_school_file' }, 'permission_denied'],
    ] as const) {
      const { repos } = setup((c) => (c.target === 'submit_school_file' ? { error } : happy(c)))
      expect(isRepositoryError(await rejection(repos.fileRepository.submit({ ...SUBMISSION, file: csv() }, { onProgress: () => {} })), code), code).toBe(true)
    }
  })

  it('the admin list selects explicit columns (never the storage path) and filters by review status', async () => {
    const { repos, calls } = setup((c) => (c.kind === 'rpc' ? { data: SUMMARY } : { data: [], count: 0 }))
    const r = await repos.fileRepository.list({ reviewStatus: 'pending', search: 'asha' })
    const q = calls.find((c) => c.kind === 'from')!
    expect(q.target).toBe('uploaded_files')
    expect(opArgs(q, 'select')[0][0]).not.toMatch(/storage_path|storage_bucket|\*/)
    expect(opArgs(q, 'select')[0][0]).toContain('review_status')
    expect(opArgs(q, 'eq')).toContainEqual(['review_status', 'pending'])
    expect(opArgs(q, 'or')[0][0]).toContain('contact_person.ilike')
    expect(r.counts.byReview).toEqual(SUMMARY.files.byReview)
    expect(isRepositoryError(await rejection(repos.fileRepository.list({ reviewStatus: 'maybe' as never })), 'invalid_filter')).toBe(true)
  })

  it('review goes through admin_review_file, and returns the detail with its history', async () => {
    const row = {
      id: UUID, reference_no: 'FILE-2026-00009', original_name: 'a.csv', file_type: 'csv', size_bytes: 3, storage_state: 'stored', school_id: UUID2, customer_name: null,
      uploaded_at: 'then', contact_person: 'Asha', contact_details: '9876543210', category: 'student_data', description: 'd'.repeat(20), instructions: null,
      review_status: 'approved', review_notes: 'ok', reviewed_at: 'now', school: { name: 'S' },
    }
    const { repos, calls } = setup((c) => {
      if (c.target === 'admin_review_file') return { data: [{ file_id: UUID, review_status: 'approved', reviewed_at: 'now' }] }
      if (c.target === 'uploaded_files') return { data: row }
      if (c.target === 'uploaded_file_reviews') return { data: [{ review_status: 'approved', review_notes: 'ok', reviewed_at: 'now' }] }
      return undefined
    })
    const d = await repos.fileRepository.review(UUID, 'approved', '  ok  ')
    expect(calls[0]).toMatchObject({ kind: 'rpc', target: 'admin_review_file', args: { p_file_id: UUID, p_status: 'approved', p_notes: 'ok' } })
    expect(d).toMatchObject({ reviewStatus: 'approved', reviewNotes: 'ok', contactDetails: '9876543210', reviewHistory: [{ status: 'approved', notes: 'ok', at: 'now' }] })
    expect(JSON.stringify(d)).not.toContain('incoming/')
  })

  it('review refuses bad input before any request, and maps the database answers', async () => {
    const { repos, calls } = setup()
    expect(isRepositoryError(await rejection(repos.fileRepository.review(UUID, 'maybe' as never)), 'invalid_status')).toBe(true)
    expect(isRepositoryError(await rejection(repos.fileRepository.review(UUID, 'approved', 'x'.repeat(1001))), 'invalid_input')).toBe(true)
    expect(isRepositoryError(await rejection(repos.fileRepository.review('', 'approved')), 'invalid_id')).toBe(true)
    expect(calls).toHaveLength(0)
    for (const [error, code] of [
      [{ code: 'P0001', message: 'no_change' }, 'no_change'],
      [{ code: 'P0002', message: 'not_found' }, 'not_found'],
      [{ code: '42501', message: 'not_authorized' }, 'permission_denied'],
      [{ code: 'PGRST301', message: 'JWT expired' }, 'permission_denied'],
    ] as const) {
      const { repos: r2 } = setup(() => ({ error }))
      expect(isRepositoryError(await rejection(r2.fileRepository.review(UUID, 'approved')), code), code).toBe(true)
    }
  })

  it('a download link is short-lived and an attachment, and a metadata-only record has none', async () => {
    const stored = setup((c) => (c.kind === 'signedUrl' ? { data: { signedUrl: 'https://example.invalid/s' } } : { data: { storage_state: 'stored', storage_bucket: 'school-uploads', storage_path: 'incoming/x.csv', original_name: 'a.csv' } }))
    expect(await stored.repos.fileRepository.getDownloadUrl(UUID)).toBe('https://example.invalid/s')
    const signed = stored.calls.find((c) => c.kind === 'signedUrl')!.args as { expiresIn: number; options: { download: string } }
    expect(signed.expiresIn).toBeLessThanOrEqual(60)
    expect(signed.options.download).toBe('a.csv')
    const meta = setup(() => ({ data: { storage_state: 'metadata_only', storage_bucket: null, storage_path: null, original_name: 'a.csv' } }))
    expect(isRepositoryError(await rejection(meta.repos.fileRepository.getDownloadUrl(UUID)), 'not_stored')).toBe(true)
    expect(meta.calls.some((c) => c.kind === 'signedUrl')).toBe(false)
  })
})

describe('dashboard', () => {
  it('derives the counts from admin_summary', async () => {
    const { repos, calls } = setup(() => ({ data: SUMMARY }))
    expect(await repos.dashboardRepository.getCounts()).toEqual({
      totalSchools: 5, activeSchools: 4, totalStudents: 18, pendingStudentReviews: 3, pendingOrders: 3, uploadedFiles: 4, pendingFileReviews: 2, awaitingCompletion: 8, pendingFeedback: 2,
    })
    expect(calls.map((c) => c.target)).toEqual(['admin_summary'])
  })

  it('each widget fails on its own', async () => {
    const { repos } = setup((c) => (c.kind === 'rpc' ? { error: { code: '', message: 'Failed to fetch' } } : { data: [] }))
    expect(isRepositoryError(await rejection(repos.dashboardRepository.getCounts()), 'network')).toBe(true)
    expect(await repos.dashboardRepository.getRecentOrders()).toEqual([])
  })
})

describe('admin content writes', () => {
  it('services: create assigns the slug and order after the existing ones; duplicate names are refused', async () => {
    const existing = [{ id: UUID, slug: 'id-cards', title: 'ID Cards', tagline: 'T', category: 'id-cards', description: 'Long enough text', image_url: null, icon: 'id-card', enabled: true, display_order: 4 }]
    const { repos, calls } = setup((c) => (ops(c).includes('insert') ? { data: { ...existing[0], id: UUID2, slug: 'lanyards', title: 'Lanyards', display_order: 5 } } : { data: existing }))
    await repos.serviceRepository.create({ title: 'Lanyards', tagline: 'Tags', category: 'id-cards', description: 'Printed lanyards for schools', icon: 'ribbon', enabled: true })
    const insert = calls.find((c) => ops(c).includes('insert'))!
    expect(opArgs(insert, 'insert')[0][0]).toMatchObject({ slug: 'lanyards', display_order: 5, image_url: null })
    expect(isRepositoryError(await rejection(repos.serviceRepository.create({ title: ' id cards ', tagline: 'Tags', category: 'id-cards', description: 'Printed lanyards for schools', icon: 'ribbon', enabled: true })), 'duplicate_title')).toBe(true)
  })

  it('feedback moderation updates only the status column', async () => {
    const row = { id: UUID, name: 'A', organization: null, rating: 5, message: 'Very good work', status: 'pending', created_at: 'now' }
    const { repos, calls } = setup((c) => ({ data: ops(c).includes('update') ? { ...row, status: 'approved' } : row }))
    expect((await repos.feedbackRepository.setStatus(UUID, 'approved')).status).toBe('approved')
    expect(opArgs(calls.find((c) => ops(c).includes('update'))!, 'update')[0][0]).toEqual({ status: 'approved' })
  })
})
