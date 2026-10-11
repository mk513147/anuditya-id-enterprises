import { nextFreeSlug } from '@/lib/slug'
import type { SchoolInput } from '@/types'
import { RepositoryError } from '../errors'
import type { SchoolRepository } from '../types'
import { SCHOOL_COLUMNS, toSchool, type SchoolRow } from './rows'
import { guarded, ilikeAny, isUuid, requireClient, requireId, searchTerm, toRepositoryError, unwrap, type Client } from './shared'

const clean = (input: SchoolInput) => ({
  name: input.name.trim(),
  slug: input.slug.trim().toLowerCase(),
  code: input.code.trim().toUpperCase(),
  contact_person: input.contactPerson.trim(),
  phone: input.phone.trim(),
  email: input.email?.trim() || null,
  address: input.address?.trim() || null,
})

/**
 * A unique violation on schools is either the code or the slug. Which one is decided by asking the database (the error
 * text is never parsed or shown), and for a slug the next free one is suggested, as the mock does.
 */
async function duplicateError(c: Client, data: ReturnType<typeof clean>, exceptId?: string): Promise<RepositoryError> {
  const others = unwrap(await guarded(() => Promise.resolve(c.from('schools').select('id, slug, code')))) as { id: string; slug: string; code: string }[]
  const rest = others.filter((s) => s.id !== exceptId)
  if (rest.some((s) => s.code.toLowerCase() === data.code.toLowerCase())) {
    return new RepositoryError('duplicate_code', `School code ${data.code} is already used by another school.`)
  }
  return new RepositoryError('duplicate_slug', `The link name "${data.slug}" is already used by another school.`, nextFreeSlug(data.slug, rest.map((s) => s.slug)))
}

export function createSupabaseSchoolRepository(client: Client | null): SchoolRepository {
  return {
    async list({ search = '', status = 'all' } = {}) {
      const c = requireClient(client)
      let q = c.from('schools').select(SCHOOL_COLUMNS).order('name')
      if (status === 'active') q = q.eq('is_active', true)
      if (status === 'inactive') q = q.eq('is_active', false)
      const term = searchTerm(search)
      if (term) q = q.or(ilikeAny(['name', 'code'], term))
      const rows = unwrap(await guarded(() => Promise.resolve(q))) as SchoolRow[]
      return rows.map(toSchool)
    },

    async listActive() {
      const c = requireClient(client)
      const rows = unwrap(await guarded(() => Promise.resolve(c.rpc('list_active_schools')))) as { id: string; name: string }[]
      return rows.map((r) => ({ id: r.id, name: r.name }))
    },

    async getDetail(id) {
      const c = requireClient(client)
      const schoolId = requireId(id, 'school')
      const row = unwrap(await guarded(() => Promise.resolve(c.from('schools').select(SCHOOL_COLUMNS).eq('id', schoolId).maybeSingle()))) as SchoolRow | null
      if (!row) throw new RepositoryError('not_found', 'School not found.')
      const count = async (table: 'students' | 'orders' | 'uploaded_files') => {
        let q = c.from(table).select('id', { count: 'exact', head: true }).eq('school_id', schoolId)
        if (table === 'students') q = q.is('archived_at', null)
        const res = await guarded(() => Promise.resolve(q))
        if (res.error) throw toRepositoryError(res.error)
        return res.count ?? 0
      }
      const [studentCount, orderCount, fileCount] = await Promise.all([count('students'), count('orders'), count('uploaded_files')])
      return { school: toSchool(row), studentCount, orderCount, fileCount }
    },

    async resolveBySlug(slug) {
      const c = requireClient(client)
      const rows = unwrap(await guarded(() => Promise.resolve(c.rpc('resolve_school', { p_slug: slug })))) as
        { status: string; school_id: string | null; name: string | null; slug: string | null }[]
      const r = rows[0]
      if (r?.status === 'active' && r.school_id && r.name && r.slug) return { status: 'active', school: { id: r.school_id, name: r.name, slug: r.slug } }
      if (r?.status === 'inactive') return { status: 'inactive' }
      return { status: 'not_found' }
    },

    async create(input) {
      const c = requireClient(client)
      const data = clean(input)
      const res = await guarded(() => Promise.resolve(c.from('schools').insert(data).select(SCHOOL_COLUMNS).single()))
      if ((res.error as { code?: string } | null)?.code === '23505') throw await duplicateError(c, data)
      return toSchool(unwrap(res) as SchoolRow)
    },

    async update(id, input) {
      const c = requireClient(client)
      const schoolId = requireId(id, 'school')
      const data = clean(input)
      const res = await guarded(() => Promise.resolve(c.from('schools').update(data).eq('id', schoolId).select(SCHOOL_COLUMNS).maybeSingle()))
      if ((res.error as { code?: string } | null)?.code === '23505') throw await duplicateError(c, data, schoolId)
      const row = unwrap(res) as SchoolRow | null
      if (!row) throw new RepositoryError('not_found', 'School not found.')
      return toSchool(row)
    },

    async setActive(id, isActive) {
      const c = requireClient(client)
      if (!isUuid(id)) throw new RepositoryError('not_found', 'School not found.')
      const row = unwrap(await guarded(() => Promise.resolve(c.from('schools').update({ is_active: isActive }).eq('id', id).select(SCHOOL_COLUMNS).maybeSingle()))) as SchoolRow | null
      if (!row) throw new RepositoryError('not_found', 'School not found.')
      return toSchool(row)
    },
  }
}
