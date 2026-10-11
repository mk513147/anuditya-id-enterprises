import { STUDENT_APPROVAL_STATUSES, type StudentEditInput } from '@/types'
import { RepositoryError } from '../errors'
import { STUDENT_EXPORT_LIMIT, type StudentListParams, type StudentRepository } from '../types'
import { ORDER_COLUMNS, STUDENT_WITH_SCHOOL, toAdminStudent, toOrder, toStudent, type OrderRow, type StudentRow } from './rows'
import { fetchSummary } from './summary'
import { fetchPage, guarded, ilikeAny, localDayBounds, requireClient, requireId, searchTerm, toRepositoryError, unwrap, type Client } from './shared'

const PHOTO_BUCKET = 'student-photos'
/** How long a photo link shown on the student page stays valid. Short: it is a picture of a minor. */
export const PHOTO_URL_SECONDS = 300

/** The photo's stored name is random (never the original file name, never anything identifying). */
function photoObjectName(file: File): { path: string; contentType: string } {
  const png = file.type === 'image/png' || /\.png$/i.test(file.name)
  return { path: `submissions/${crypto.randomUUID()}.${png ? 'png' : 'jpg'}`, contentType: png ? 'image/png' : 'image/jpeg' }
}

const SUBMIT_ERRORS = { invalid_photo: 'invalid_input', photo_not_uploaded: 'invalid_input' } as const

/** Validates the filters (before any request is made) and returns the timestamp bounds for the date range. */
function checkFilters({ approval = 'all', submittedFrom, submittedTo }: StudentListParams) {
  if (approval !== 'all' && !(STUDENT_APPROVAL_STATUSES as readonly string[]).includes(approval)) throw new RepositoryError('invalid_filter', 'That review status is not supported.')
  return localDayBounds(submittedFrom, submittedTo)
}

function applyFilters(c: Client, params: StudentListParams, count: boolean) {
  const { search, schoolId, className, section, status = 'active', approval = 'all' } = params
  const dates = checkFilters(params)
  let q = c.from('students').select(STUDENT_WITH_SCHOOL, count ? { count: 'exact' } : undefined)
  if (status === 'active') q = q.is('archived_at', null)
  if (status === 'archived') q = q.not('archived_at', 'is', null)
  if (approval !== 'all') q = q.eq('approval_status', approval)
  if (schoolId) q = q.eq('school_id', schoolId)
  if (className) q = q.eq('class_name', className)
  if (section) q = q.eq('section', section.trim().toUpperCase())
  if (dates.gte) q = q.gte('submitted_at', dates.gte)
  if (dates.lt) q = q.lt('submitted_at', dates.lt)
  const term = searchTerm(search)
  if (term) q = q.or(ilikeAny(['name', 'reference_no', 'admission_no', 'roll_no'], term))
  return q.order('submitted_at', { ascending: false }).order('reference_no', { ascending: false })
}

const toColumns = (input: StudentEditInput) => ({
  name: input.name.trim(),
  father_name: input.fatherName.trim(),
  mother_name: input.motherName.trim(),
  dob: input.dob,
  class_name: input.className,
  section: input.section.trim().toUpperCase(),
  roll_no: input.rollNo.trim(),
  admission_no: input.admissionNo.trim(),
  address: input.address.trim(),
  mobile: input.mobile.trim(),
  blood_group: input.bloodGroup || null,
  house_name: input.houseName?.trim() || null,
  house_colour: input.houseColour?.trim() || null,
  bus_route: input.busRoute?.trim() || null,
  bus_stoppage: input.busStoppage?.trim() || null,
})

export function createSupabaseStudentRepository(client: Client | null): StudentRepository {
  async function readOne(c: Client, id: string) {
    const row = unwrap(await guarded(() => Promise.resolve(c.from('students').select(STUDENT_WITH_SCHOOL).eq('id', id).maybeSingle()))) as StudentRow | null
    if (!row) throw new RepositoryError('not_found', 'Student not found.')
    return row
  }

  return {
    async submit(input) {
      const c = requireClient(client)
      // 1. The photo goes into the PRIVATE bucket under a random name. Anonymous visitors may only insert there; they can
      //    never read, list, overwrite or delete objects. 2. The database function checks the object really exists, has
      //    the allowed type/size and is unused, re-checks the school, and stores the record as 'pending'.
      const { path, contentType } = photoObjectName(input.photo)
      const upload = await guarded(() => c.storage.from(PHOTO_BUCKET).upload(path, input.photo, { contentType, upsert: false, cacheControl: '0' }))
      if (upload.error) throw toRepositoryError(upload.error)
      const rows = unwrap(
        await guarded(() =>
          Promise.resolve(
            c.rpc('submit_student', {
              p_school_id: input.schoolId,
              p_name: input.name,
              p_father_name: input.fatherName,
              p_mother_name: input.motherName,
              p_dob: input.dob,
              p_class_name: input.className,
              p_section: input.section,
              p_roll_no: input.rollNo,
              p_admission_no: input.admissionNo,
              p_address: input.address,
              p_mobile: input.mobile,
              p_blood_group: input.bloodGroup || null,
              p_house_name: input.houseName || null,
              p_house_colour: input.houseColour || null,
              p_bus_route: input.busRoute || null,
              p_bus_stoppage: input.busStoppage || null,
              p_photo_path: path,
            }),
          ),
        ),
        { byMessage: SUBMIT_ERRORS, unique: 'invalid_input' },
      ) as { reference_no: string; submitted_at: string; school_name: string }[]
      const r = rows[0]
      if (!r) throw new RepositoryError('unknown', 'The submission could not be confirmed. Please try again.')
      return { referenceNo: r.reference_no, submittedAt: r.submitted_at, schoolName: r.school_name }
    },

    async list(params = {}) {
      const c = requireClient(client)
      checkFilters(params)
      const query = () => applyFilters(c, params, true)
      const [page, summary] = await Promise.all([
        fetchPage<StudentRow>((from, to) => query().range(from, to), params.page, params.pageSize),
        fetchSummary(c),
      ])
      return {
        ...page,
        items: page.items.map(toAdminStudent),
        counts: {
          active: summary.students.notArchived,
          archived: summary.students.archived,
          pending: summary.students.pending,
          approved: summary.students.approved,
          rejected: summary.students.rejected,
        },
      }
    },

    async getDetail(id) {
      const c = requireClient(client)
      const studentId = requireId(id, 'student')
      const row = unwrap(
        await guarded(() => Promise.resolve(c.from('students').select(`${STUDENT_WITH_SCHOOL}, photo_path`).eq('id', studentId).maybeSingle())),
      ) as (StudentRow & { photo_path: string | null }) | null
      if (!row) throw new RepositoryError('not_found', 'Student not found.')
      const orders = unwrap(
        await guarded(() => Promise.resolve(c.from('orders').select(ORDER_COLUMNS).eq('school_id', row.school_id).order('order_date', { ascending: false }).limit(50))),
      ) as OrderRow[]
      const student = toAdminStudent(row)
      const photoPath = row.photo_path
      if (photoPath) {
        // A short-lived link, created on demand for the administrator only (the bucket stays private).
        const signed = await guarded(() => c.storage.from(PHOTO_BUCKET).createSignedUrl(photoPath, PHOTO_URL_SECONDS))
        if (!signed.error && signed.data?.signedUrl) student.photoUrl = signed.data.signedUrl
      }
      return { student, schoolOrders: orders.map(toOrder) }
    },

    async update(id, input) {
      const c = requireClient(client)
      const studentId = requireId(id, 'student')
      const res = await guarded(() => Promise.resolve(c.from('students').update(toColumns(input)).eq('id', studentId).select(STUDENT_WITH_SCHOOL).maybeSingle()))
      const row = unwrap(res, { unique: 'duplicate_admission_no' }) as StudentRow | null
      if (!row) throw new RepositoryError('not_found', 'Student not found.')
      return toStudent(row)
    },

    async setArchived(id, archived) {
      const c = requireClient(client)
      const studentId = requireId(id, 'student')
      const res = await guarded(() =>
        Promise.resolve(c.from('students').update({ archived_at: archived ? new Date().toISOString() : null }).eq('id', studentId).select(STUDENT_WITH_SCHOOL).maybeSingle()),
      )
      const row = unwrap(res, { unique: 'duplicate_admission_no' }) as StudentRow | null
      if (!row) throw new RepositoryError('not_found', 'Student not found.')
      return toStudent(row)
    },

    async getFilterOptions() {
      return { sections: (await fetchSummary(client)).studentSections }
    },

    async review(id, decision) {
      const c = requireClient(client)
      const studentId = requireId(id, 'student')
      if (!(STUDENT_APPROVAL_STATUSES as readonly string[]).includes(decision)) throw new RepositoryError('invalid_status', 'That is not a supported review decision.')
      unwrap(await guarded(() => Promise.resolve(c.rpc('admin_review_student', { p_student_id: studentId, p_decision: decision }))))
      return toStudent(await readOne(c, studentId))
    },

    async exportRows(params = {}) {
      const c = requireClient(client)
      checkFilters(params)
      const batch = 1000
      const rows: StudentRow[] = []
      // Pages of 1000 (the API's default maximum), stopping at the export cap. One more row than the cap tells us it was hit.
      while (rows.length <= STUDENT_EXPORT_LIMIT) {
        const from = rows.length
        const data = unwrap(await guarded(() => Promise.resolve(applyFilters(c, params, false).range(from, from + batch - 1)))) as StudentRow[]
        rows.push(...data)
        if (data.length < batch) break
      }
      return { rows: rows.slice(0, STUDENT_EXPORT_LIMIT).map(toAdminStudent), truncated: rows.length > STUDENT_EXPORT_LIMIT }
    },
  }
}
