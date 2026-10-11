import { describe, expect, it, vi } from 'vitest'
import { AuthController, type AuthBackend, type AuthEvent, type BackendSession, type BackendSignInResult } from './authController'

const ADMIN: BackendSession = { userId: 'u-admin', email: 'admin@example.invalid' }
const OTHER: BackendSession = { userId: 'u-other', email: 'other@example.invalid' }
const tick = () => new Promise<void>((r) => setTimeout(r, 5))

/** A controllable stand-in for Supabase Auth. */
function fakeBackend(opts: { session?: BackendSession | null; roles?: Record<string, 'admin' | 'none'>; signIn?: (e: string, p: string) => BackendSignInResult; getSessionDelay?: Promise<void> } = {}) {
  let listener: ((e: AuthEvent, s: BackendSession | null) => void) | null = null
  let session: BackendSession | null = opts.session ?? null
  const roles = opts.roles ?? { 'u-admin': 'admin', 'u-other': 'none' }
  const b = {
    configured: true,
    subscribeCalls: 0,
    unsubscribeCalls: 0,
    signOutCalls: 0,
    roleCalls: 0,
    failRole: false,
    failSignOut: false,
    roleGate: null as Promise<void> | null,
    async getSession() {
      if (opts.getSessionDelay) await opts.getSessionDelay
      return session
    },
    onAuthChange(l: (e: AuthEvent, s: BackendSession | null) => void) {
      b.subscribeCalls++
      listener = l
      return () => {
        b.unsubscribeCalls++
        listener = null
      }
    },
    async signIn(email: string, password: string): Promise<BackendSignInResult> {
      const r = opts.signIn ? opts.signIn(email, password) : (password === 'right' ? { ok: true as const, session: email.startsWith('other') ? OTHER : ADMIN } : { ok: false as const, reason: 'invalid' as const })
      if (r.ok) {
        session = r.session
        listener?.('SIGNED_IN', r.session)
      }
      return r
    },
    async signOut() {
      b.signOutCalls++
      if (b.failSignOut) throw new Error('offline')
      session = null
      listener?.('SIGNED_OUT', null)
    },
    async fetchRole(userId: string) {
      b.roleCalls++
      if (b.roleGate) await b.roleGate
      if (b.failRole) throw new Error('db unreachable')
      return roles[userId] ?? 'none'
    },
    emit(e: AuthEvent, s: BackendSession | null) {
      session = s
      listener?.(e, s)
    },
  }
  return b satisfies AuthBackend & Record<string, unknown>
}

describe('loading, restoration and not-configured', () => {
  it('starts in "loading": no admin content may be shown yet', () => {
    const c = new AuthController(fakeBackend())
    expect(c.getSnapshot()).toMatchObject({ status: 'loading', roleStatus: 'unknown', configured: true })
  })

  it('stays loading until the stored session has been read, then restores a verified administrator', async () => {
    let release!: () => void
    const b = fakeBackend({ session: ADMIN, getSessionDelay: new Promise<void>((r) => (release = r)) })
    const c = new AuthController(b)
    c.start()
    await tick()
    expect(c.getSnapshot().status).toBe('loading')
    release()
    await tick()
    expect(c.getSnapshot()).toMatchObject({ status: 'signed-in', roleStatus: 'admin', email: 'admin@example.invalid' })
  })

  it('restores nothing when there is no stored session', async () => {
    const c = new AuthController(fakeBackend({ session: null }))
    c.start()
    await tick()
    expect(c.getSnapshot()).toMatchObject({ status: 'signed-out', roleStatus: 'unknown', sessionExpired: false })
  })

  it('restores a signed-in user who is NOT the administrator as "not-admin" (never as admin)', async () => {
    const c = new AuthController(fakeBackend({ session: OTHER }))
    c.start()
    await tick()
    expect(c.getSnapshot()).toMatchObject({ status: 'signed-in', roleStatus: 'not-admin' })
  })

  it('uses the INITIAL_SESSION event as well as the fallback read without verifying the role twice', async () => {
    const b = fakeBackend({ session: ADMIN })
    const c = new AuthController(b)
    c.start()
    b.emit('INITIAL_SESSION', ADMIN)
    await tick()
    expect(c.getSnapshot().roleStatus).toBe('admin')
    expect(b.roleCalls).toBe(1)
  })

  it('treats an unreadable stored session as signed out', async () => {
    const b = fakeBackend()
    b.getSession = async () => {
      throw new Error('storage unavailable')
    }
    const c = new AuthController(b)
    c.start()
    await tick()
    expect(c.getSnapshot().status).toBe('signed-out')
  })

  it('is closed and says so when Supabase is not configured', async () => {
    const c = new AuthController({ ...fakeBackend(), configured: false })
    c.start()
    expect(c.getSnapshot()).toMatchObject({ status: 'signed-out', configured: false })
    expect(await c.login('a@b.co', 'x')).toEqual({ ok: false, error: 'not_configured' })
  })
})

describe('subscriptions', () => {
  it('creates exactly one backend subscription however many times it is started (StrictMode double mount)', () => {
    const b = fakeBackend()
    const c = new AuthController(b)
    c.start()
    c.stop()
    c.start() // StrictMode: mount, unmount, mount
    c.start()
    expect(b.subscribeCalls).toBe(2) // one for the first mount, one after it was fully released; never two at once
    c.stop()
    expect(b.unsubscribeCalls).toBe(1) // still one user left
    c.stop()
    expect(b.unsubscribeCalls).toBe(2)
  })

  it('does not subscribe a second time while already subscribed', () => {
    const b = fakeBackend()
    const c = new AuthController(b)
    c.start()
    c.start()
    expect(b.subscribeCalls).toBe(1)
  })

  it('notifies listeners only when the state actually changes, with a stable snapshot between changes', async () => {
    const c = new AuthController(fakeBackend({ session: null }))
    const seen = vi.fn()
    c.subscribe(seen)
    const first = c.getSnapshot()
    expect(c.getSnapshot()).toBe(first)
    c.start()
    await tick()
    const calls = seen.mock.calls.length
    expect(calls).toBeGreaterThan(0)
    c.retryRole() // nothing to do while signed out
    expect(seen.mock.calls.length).toBe(calls)
  })
})

describe('login', () => {
  it('succeeds for the administrator and verifies the role before reporting success', async () => {
    const b = fakeBackend()
    const c = new AuthController(b)
    c.start()
    await tick()
    expect(await c.login('admin@example.invalid', 'right')).toEqual({ ok: true })
    expect(c.getSnapshot()).toMatchObject({ status: 'signed-in', roleStatus: 'admin', email: 'admin@example.invalid' })
    expect(b.roleCalls).toBe(1)
    await tick() // the SIGNED_IN event that Supabase also fires must not cause another check or change anything
    expect(b.roleCalls).toBe(1)
    expect(c.getSnapshot().roleStatus).toBe('admin')
  })

  it('reports invalid credentials without signing anyone in', async () => {
    const b = fakeBackend()
    const c = new AuthController(b)
    c.start()
    await tick()
    expect(await c.login('admin@example.invalid', 'wrong')).toEqual({ ok: false, error: 'invalid' })
    expect(c.getSnapshot().status).toBe('signed-out')
    expect(b.roleCalls).toBe(0)
  })

  it.each(['rate_limited', 'network', 'unknown'] as const)('passes through the "%s" failure', async (reason) => {
    const c = new AuthController(fakeBackend({ signIn: () => ({ ok: false, reason }) }))
    c.start()
    await tick()
    expect(await c.login('a@b.co', 'x')).toEqual({ ok: false, error: reason })
    expect(c.getSnapshot().status).toBe('signed-out')
  })

  it('REJECTS a valid account that is not the administrator and signs it straight out', async () => {
    const b = fakeBackend()
    const c = new AuthController(b)
    c.start()
    await tick()
    expect(await c.login('other@example.invalid', 'right')).toEqual({ ok: false, error: 'not_admin' })
    await tick() // the deferred SIGNED_IN handling must not bring the rejected user back
    expect(b.signOutCalls).toBe(1)
    expect(c.getSnapshot()).toMatchObject({ status: 'signed-out', roleStatus: 'unknown', email: null })
  })

  it('denies access (and signs out) when the role cannot be verified', async () => {
    const b = fakeBackend()
    b.failRole = true
    const c = new AuthController(b)
    c.start()
    await tick()
    expect(await c.login('admin@example.invalid', 'right')).toEqual({ ok: false, error: 'role_error' })
    await tick()
    expect(c.getSnapshot()).toMatchObject({ status: 'signed-out', roleStatus: 'unknown' })
  })
})

describe('logout', () => {
  it('signs out, clears the user, drops cached data and is not reported as an expired session', async () => {
    const onSignedOut = vi.fn()
    const b = fakeBackend({ session: ADMIN })
    const c = new AuthController(b, { onSignedOut })
    c.start()
    await tick()
    await c.logout()
    expect(c.getSnapshot()).toMatchObject({ status: 'signed-out', roleStatus: 'unknown', email: null, sessionExpired: false })
    expect(onSignedOut).toHaveBeenCalledTimes(1)
    expect(b.signOutCalls).toBe(1)
  })

  it('still closes the admin area when the sign-out request itself fails', async () => {
    const b = fakeBackend({ session: ADMIN })
    b.failSignOut = true
    const c = new AuthController(b)
    c.start()
    await tick()
    await c.logout()
    expect(c.getSnapshot().status).toBe('signed-out')
  })
})

describe('expired or revoked sessions', () => {
  it('flags a session that ended without the user asking, so the login page can explain', async () => {
    const onSignedOut = vi.fn()
    const b = fakeBackend({ session: ADMIN })
    const c = new AuthController(b, { onSignedOut })
    c.start()
    await tick()
    b.emit('SIGNED_OUT', null) // token refresh failed / session revoked elsewhere
    expect(c.getSnapshot()).toMatchObject({ status: 'signed-out', roleStatus: 'unknown', sessionExpired: true })
    expect(onSignedOut).toHaveBeenCalledTimes(1)
  })

  it('does not call a never-signed-in page load an expired session', async () => {
    const b = fakeBackend({ session: null })
    const c = new AuthController(b)
    c.start()
    b.emit('INITIAL_SESSION', null)
    expect(c.getSnapshot().sessionExpired).toBe(false)
  })

  it('a later sign-in clears the expired flag', async () => {
    const b = fakeBackend({ session: ADMIN })
    const c = new AuthController(b)
    c.start()
    await tick()
    b.emit('SIGNED_OUT', null)
    expect(c.getSnapshot().sessionExpired).toBe(true)
    await c.login('admin@example.invalid', 'right')
    expect(c.getSnapshot().sessionExpired).toBe(false)
  })
})

describe('role re-verification', () => {
  it('re-checks the role when the token is refreshed, and closes the panel if the user is no longer the administrator', async () => {
    const roles: Record<string, 'admin' | 'none'> = { 'u-admin': 'admin' }
    const b = fakeBackend({ session: ADMIN, roles })
    const c = new AuthController(b)
    c.start()
    await tick()
    expect(c.getSnapshot().roleStatus).toBe('admin')
    roles['u-admin'] = 'none' // role removed in the database
    b.emit('TOKEN_REFRESHED', ADMIN)
    await tick()
    expect(c.getSnapshot().roleStatus).toBe('not-admin')
  })

  it('keeps a verified administrator signed in through a failed background re-check (the database still enforces permissions)', async () => {
    const b = fakeBackend({ session: ADMIN })
    const c = new AuthController(b)
    c.start()
    await tick()
    b.failRole = true
    b.emit('TOKEN_REFRESHED', ADMIN)
    await tick()
    expect(c.getSnapshot().roleStatus).toBe('admin')
  })

  it('offers a retry after a failed first check, and a successful retry opens the panel', async () => {
    const b = fakeBackend({ session: ADMIN })
    b.failRole = true
    const c = new AuthController(b)
    c.start()
    await tick()
    expect(c.getSnapshot()).toMatchObject({ status: 'signed-in', roleStatus: 'error' })
    b.failRole = false
    c.retryRole()
    await tick()
    expect(c.getSnapshot().roleStatus).toBe('admin')
  })

  it('ignores a slow answer for a user who has since signed out', async () => {
    let release!: () => void
    const b = fakeBackend({ session: ADMIN })
    b.roleGate = new Promise<void>((r) => (release = r))
    const c = new AuthController(b)
    c.start()
    await tick()
    expect(c.getSnapshot().roleStatus).toBe('checking')
    b.emit('SIGNED_OUT', null)
    release()
    await tick()
    expect(c.getSnapshot()).toMatchObject({ status: 'signed-out', roleStatus: 'unknown' })
  })

  it('never shows "admin" for a different user than the one that was verified', async () => {
    const b = fakeBackend({ session: ADMIN })
    const c = new AuthController(b)
    c.start()
    await tick()
    b.emit('SIGNED_IN', OTHER)
    await tick()
    expect(c.getSnapshot()).toMatchObject({ roleStatus: 'not-admin', email: 'other@example.invalid' })
  })
})
