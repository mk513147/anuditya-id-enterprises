import { describe, expect, it, vi } from 'vitest'
import { isPrivilegedKey, validateSupabaseConfig } from '@/lib/supabaseConfig'
import { classifySignInError, createSupabaseBackend, type SupabaseAuthClient } from './supabaseBackend'

type Session = { user: { id: string; email?: string | null } } | null
const jwt = (role: string) => `eyJhbGciOiJIUzI1NiJ9.${btoa(JSON.stringify({ role })).replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_')}.sig`

function fakeClient(over: { session?: Session; signIn?: unknown; role?: { data: { role: string } | null; error: unknown } } = {}) {
  const calls = { select: [] as string[], eq: [] as [string, string][], from: [] as string[], signIn: [] as { email: string; password: string }[] }
  const unsubscribe = vi.fn()
  let cb: ((e: string, s: Session) => void) | null = null
  const client = {
    auth: {
      getSession: async () => ({ data: { session: over.session ?? null }, error: null }),
      onAuthStateChange: (c: (e: string, s: Session) => void) => {
        cb = c
        return { data: { subscription: { unsubscribe } } }
      },
      signInWithPassword: async (cred: { email: string; password: string }) => {
        calls.signIn.push(cred)
        return (over.signIn as never) ?? { data: { session: { user: { id: 'u1', email: cred.email } } }, error: null }
      },
      signOut: vi.fn(async () => ({ error: null })),
    },
    from: (t: 'profiles') => {
      calls.from.push(t)
      return {
        select: (c: 'role') => {
          calls.select.push(c)
          return { eq: (col: 'id', v: string) => (calls.eq.push([col, v]), { maybeSingle: async () => over.role ?? { data: { role: 'admin' }, error: null } }) }
        },
      }
    },
  } satisfies SupabaseAuthClient
  return { client, calls, unsubscribe, emit: (e: string, s: Session) => cb?.(e, s) }
}

describe('Supabase backend adapter', () => {
  it('signs in with the password and returns the user id and email', async () => {
    const { client, calls } = fakeClient()
    const r = await createSupabaseBackend(client).signIn('admin@example.invalid', 'pw')
    expect(r).toEqual({ ok: true, session: { userId: 'u1', email: 'admin@example.invalid' } })
    expect(calls.signIn).toEqual([{ email: 'admin@example.invalid', password: 'pw' }])
  })

  it('maps Supabase errors to safe reasons', () => {
    expect(classifySignInError({ code: 'invalid_credentials', status: 400 })).toBe('invalid')
    expect(classifySignInError({ status: 400, message: 'Invalid login credentials' })).toBe('invalid')
    expect(classifySignInError({ code: 'email_not_confirmed', status: 400 })).toBe('invalid')
    expect(classifySignInError({ status: 429 })).toBe('rate_limited')
    expect(classifySignInError({ code: 'over_request_rate_limit' })).toBe('rate_limited')
    expect(classifySignInError({ name: 'AuthRetryableFetchError', status: 0 })).toBe('network')
    expect(classifySignInError({ message: 'Failed to fetch' })).toBe('network')
    expect(classifySignInError({ status: 500, message: 'boom' })).toBe('unknown')
  })

  it('reports a thrown network failure and a missing session without leaking details', async () => {
    const a = fakeClient()
    a.client.auth.signInWithPassword = async () => {
      throw new TypeError('Failed to fetch')
    }
    expect(await createSupabaseBackend(a.client).signIn('a@b.co', 'x')).toEqual({ ok: false, reason: 'network' })
    const b = fakeClient({ signIn: { data: { session: null }, error: null } })
    expect(await createSupabaseBackend(b.client).signIn('a@b.co', 'x')).toEqual({ ok: false, reason: 'unknown' })
    const c = fakeClient({ signIn: { data: { session: null }, error: { code: 'invalid_credentials', status: 400 } } })
    expect(await createSupabaseBackend(c.client).signIn('a@b.co', 'x')).toEqual({ ok: false, reason: 'invalid' })
  })

  it('reads the role from the caller\'s own profile row only (profiles.role filtered by the user id)', async () => {
    const { client, calls } = fakeClient()
    expect(await createSupabaseBackend(client).fetchRole('u1')).toBe('admin')
    expect(calls.from).toEqual(['profiles'])
    expect(calls.select).toEqual(['role'])
    expect(calls.eq).toEqual([['id', 'u1']])
  })

  it('treats a missing profile or any other role as NOT an administrator', async () => {
    expect(await createSupabaseBackend(fakeClient({ role: { data: null, error: null } }).client).fetchRole('u1')).toBe('none')
    expect(await createSupabaseBackend(fakeClient({ role: { data: { role: 'staff' }, error: null } }).client).fetchRole('u1')).toBe('none')
    expect(await createSupabaseBackend(fakeClient({ role: { data: { role: 'ADMIN' }, error: null } }).client).fetchRole('u1')).toBe('none')
  })

  it('throws (so access is denied) when the profile query fails', async () => {
    const { client } = fakeClient({ role: { data: null, error: { message: 'permission denied' } } })
    await expect(createSupabaseBackend(client).fetchRole('u1')).rejects.toBeTruthy()
  })

  it('restores the stored session, forwards auth events and unsubscribes', async () => {
    const { client, emit, unsubscribe } = fakeClient({ session: { user: { id: 'u1', email: 'a@b.co' } } })
    const backend = createSupabaseBackend(client)
    expect(await backend.getSession()).toEqual({ userId: 'u1', email: 'a@b.co' })
    const seen: unknown[] = []
    const off = backend.onAuthChange((e, s) => seen.push([e, s]))
    emit('TOKEN_REFRESHED', { user: { id: 'u1', email: 'a@b.co' } })
    emit('SIGNED_OUT', null)
    expect(seen).toEqual([['TOKEN_REFRESHED', { userId: 'u1', email: 'a@b.co' }], ['SIGNED_OUT', null]])
    off()
    expect(unsubscribe).toHaveBeenCalledTimes(1)
  })

  it('signs out through Supabase', async () => {
    const { client } = fakeClient()
    await createSupabaseBackend(client).signOut()
    expect(client.auth.signOut).toHaveBeenCalledTimes(1)
  })

  it('is closed (not configured) without a client', async () => {
    const b = createSupabaseBackend(null)
    expect(b.configured).toBe(false)
    expect(await b.getSession()).toBeNull()
    await expect(b.fetchRole('u1')).rejects.toBeTruthy()
  })
})

describe('public Supabase settings validation', () => {
  it('accepts an https project URL with a publishable or anon key', () => {
    expect(validateSupabaseConfig('https://abc.supabase.co/', 'sb_publishable_abc')).toEqual({ ok: true, url: 'https://abc.supabase.co', key: 'sb_publishable_abc' })
    expect(validateSupabaseConfig('https://abc.supabase.co', jwt('anon')).ok).toBe(true)
  })

  it('refuses missing values, bad URLs and plain http (except localhost)', () => {
    expect(validateSupabaseConfig(undefined, 'sb_publishable_abc')).toEqual({ ok: false, reason: 'missing' })
    expect(validateSupabaseConfig('https://abc.supabase.co', '')).toEqual({ ok: false, reason: 'missing' })
    expect(validateSupabaseConfig('not a url', 'sb_publishable_abc')).toEqual({ ok: false, reason: 'invalid_url' })
    expect(validateSupabaseConfig('http://abc.supabase.co', 'sb_publishable_abc')).toEqual({ ok: false, reason: 'insecure_url' })
    expect(validateSupabaseConfig('http://127.0.0.1:54321', 'sb_publishable_abc').ok).toBe(true)
  })

  it('REFUSES a secret or service-role key, which would be shipped to every visitor', () => {
    expect(validateSupabaseConfig('https://abc.supabase.co', 'sb_secret_abc')).toEqual({ ok: false, reason: 'privileged_key' })
    expect(validateSupabaseConfig('https://abc.supabase.co', jwt('service_role'))).toEqual({ ok: false, reason: 'privileged_key' })
    expect(isPrivilegedKey(jwt('authenticated'))).toBe(true)
    expect(isPrivilegedKey(jwt('anon'))).toBe(false)
    expect(isPrivilegedKey('sb_publishable_abc')).toBe(false)
  })

  it('refuses a key that is not recognisably a publishable or anon key', () => {
    expect(validateSupabaseConfig('https://abc.supabase.co', 'somethingelse')).toEqual({ ok: false, reason: 'unrecognised_key' })
  })
})
