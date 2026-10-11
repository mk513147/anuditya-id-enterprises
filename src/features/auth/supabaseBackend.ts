import type { AuthBackend, AuthEvent, BackendSession, BackendSignInResult } from './authController'

/** The small part of the Supabase client this app uses (structural, so tests can pass a fake). Public key only. */
export interface SupabaseAuthClient {
  auth: {
    getSession(): Promise<{ data: { session: { user: { id: string; email?: string | null } } | null }; error: unknown }>
    onAuthStateChange(cb: (event: string, session: { user: { id: string; email?: string | null } } | null) => void): {
      data: { subscription: { unsubscribe(): void } }
    }
    signInWithPassword(credentials: { email: string; password: string }): Promise<{
      data: { session: { user: { id: string; email?: string | null } } | null }
      error: { code?: string; status?: number; name?: string; message?: string } | null
    }>
    signOut(): Promise<{ error: unknown }>
  }
  from(table: 'profiles'): {
    select(columns: 'role'): {
      eq(column: 'id', value: string): { maybeSingle(): Promise<{ data: { role: string } | null; error: unknown }> }
    }
  }
}

const toSession = (s: { user: { id: string; email?: string | null } } | null): BackendSession | null =>
  s ? { userId: s.user.id, email: s.user.email ?? null } : null

/** Maps a Supabase Auth error to a reason the UI can explain without leaking details (no account enumeration). */
export function classifySignInError(error: { code?: string; status?: number; name?: string; message?: string }): 'invalid' | 'rate_limited' | 'network' | 'unknown' {
  const code = error.code ?? ''
  if (code === 'invalid_credentials' || code === 'invalid_grant' || code === 'user_not_found' || code === 'email_not_confirmed') return 'invalid'
  if (error.status === 429 || code === 'over_request_rate_limit' || code === 'over_email_send_rate_limit') return 'rate_limited'
  if (error.name === 'AuthRetryableFetchError' || error.status === 0 || (error.status === undefined && /fetch|network/i.test(error.message ?? ''))) return 'network'
  if (error.status === 400 && /invalid login credentials/i.test(error.message ?? '')) return 'invalid'
  return 'unknown'
}

/**
 * Adapts the Supabase client to the controller's AuthBackend.
 * The role is read from `public.profiles`: its RLS policy lets a user read ONLY their own row, so this can only ever
 * describe the caller. It is a UI check; the database enforces administrator permissions itself.
 */
export function createSupabaseBackend(client: SupabaseAuthClient | null): AuthBackend {
  if (!client) {
    const unavailable = async () => {
      throw new Error('Supabase is not configured')
    }
    return { configured: false, getSession: async () => null, onAuthChange: () => () => {}, signIn: unavailable, signOut: async () => {}, fetchRole: unavailable }
  }
  return {
    configured: true,

    async getSession() {
      const { data, error } = await client.auth.getSession()
      if (error) throw error
      return toSession(data.session)
    },

    onAuthChange(listener) {
      const { data } = client.auth.onAuthStateChange((event, session) => listener(event as AuthEvent, toSession(session)))
      return () => data.subscription.unsubscribe()
    },

    async signIn(email, password): Promise<BackendSignInResult> {
      try {
        const { data, error } = await client.auth.signInWithPassword({ email, password })
        if (error) return { ok: false, reason: classifySignInError(error) }
        const session = toSession(data.session)
        return session ? { ok: true, session } : { ok: false, reason: 'unknown' }
      } catch {
        return { ok: false, reason: 'network' }
      }
    },

    async signOut() {
      await client.auth.signOut()
    },

    async fetchRole(userId) {
      const { data, error } = await client.from('profiles').select('role').eq('id', userId).maybeSingle()
      if (error) throw error
      return data?.role === 'admin' ? 'admin' : 'none'
    },
  }
}
