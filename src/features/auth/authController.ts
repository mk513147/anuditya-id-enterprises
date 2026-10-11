/**
 * Framework-free authentication state machine for the administrator area.
 *
 * Authorisation reminder: everything here is USER-INTERFACE gating. The database (RLS, column grants and the admin
 * functions) is what actually protects data; a client that skips or fakes these checks still cannot read or change
 * anything the administrator alone may. Never rely on this file for security.
 */

export type AuthStatus = 'loading' | 'signed-out' | 'signed-in'
/** unknown = not signed in yet; checking = the role is being verified; error = verification failed (deny, offer retry). */
export type RoleStatus = 'unknown' | 'checking' | 'admin' | 'not-admin' | 'error'

export interface AuthSnapshot {
  readonly status: AuthStatus
  readonly roleStatus: RoleStatus
  readonly email: string | null
  /** True when the session ended without the user asking (expired or revoked), so the login page can say so. */
  readonly sessionExpired: boolean
  /** False when the site has no valid public Supabase settings; nothing can be signed in then. */
  readonly configured: boolean
}

export interface BackendSession {
  readonly userId: string
  readonly email: string | null
}

export type AuthEvent = 'INITIAL_SESSION' | 'SIGNED_IN' | 'SIGNED_OUT' | 'TOKEN_REFRESHED' | 'USER_UPDATED' | string

export type SignInFailure = 'invalid' | 'rate_limited' | 'network' | 'unknown'
export type BackendSignInResult = { ok: true; session: BackendSession } | { ok: false; reason: SignInFailure }

/** What the controller needs from an identity provider. The real one is supabaseBackend.ts; tests use a fake. */
export interface AuthBackend {
  readonly configured: boolean
  getSession(): Promise<BackendSession | null>
  /** Subscribes to session changes. Returns the unsubscribe function. */
  onAuthChange(listener: (event: AuthEvent, session: BackendSession | null) => void): () => void
  signIn(email: string, password: string): Promise<BackendSignInResult>
  signOut(): Promise<void>
  /** Reads the signed-in user's role from the database. Throws if it could not be determined. */
  fetchRole(userId: string): Promise<'admin' | 'none'>
}

export type LoginResult =
  | { ok: true }
  | { ok: false; error: SignInFailure | 'not_configured' | 'not_admin' | 'role_error' }

export interface AuthControllerHooks {
  /** Called whenever the signed-in user goes away, so cached admin data can be dropped. */
  onSignedOut?: () => void
}

const INITIAL: AuthSnapshot = { status: 'loading', roleStatus: 'unknown', email: null, sessionExpired: false, configured: true }

export class AuthController {
  private snapshot: AuthSnapshot
  private readonly listeners = new Set<() => void>()
  private readonly backend: AuthBackend
  private readonly hooks: AuthControllerHooks
  private unsubscribeBackend: (() => void) | null = null
  private users = 0
  private userId: string | null = null
  private roleRun = 0
  private signingOut = false
  /** Bumped whenever the user goes away, so a deferred callback queued for an earlier session can be ignored. */
  private epoch = 0

  constructor(backend: AuthBackend, hooks: AuthControllerHooks = {}) {
    this.backend = backend
    this.hooks = hooks
    this.snapshot = backend.configured ? INITIAL : { ...INITIAL, status: 'signed-out', configured: false }
  }

  // ---- external-store contract (useSyncExternalStore) ------------------------------------------------------------------
  getSnapshot = (): AuthSnapshot => this.snapshot

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  // ---- lifecycle: reference-counted so StrictMode's mount/unmount/mount never creates two backend subscriptions -----------
  start(): void {
    this.users += 1
    if (this.users > 1 || !this.backend.configured) return
    this.unsubscribeBackend = this.backend.onAuthChange((event, session) => this.onEvent(event, session))
    // Fallback in case no INITIAL_SESSION event arrives; adoption is idempotent.
    const epoch = this.epoch
    void this.backend.getSession().then(
      (session) => {
        if (epoch === this.epoch && this.snapshot.status === 'loading') this.adopt(session)
      },
      () => {
        if (epoch === this.epoch && this.snapshot.status === 'loading') this.set({ status: 'signed-out', roleStatus: 'unknown', email: null })
      },
    )
  }

  stop(): void {
    this.users = Math.max(0, this.users - 1)
    if (this.users === 0 && this.unsubscribeBackend) {
      this.unsubscribeBackend()
      this.unsubscribeBackend = null
    }
  }

  // ---- actions ------------------------------------------------------------------------------------------------------------
  async login(email: string, password: string): Promise<LoginResult> {
    if (!this.backend.configured) return { ok: false, error: 'not_configured' }
    const result = await this.backend.signIn(email, password)
    if (!result.ok) return { ok: false, error: result.reason }
    // Verify the role BEFORE reporting success. An account without the administrator role is signed straight out.
    this.userId = result.session.userId
    const run = ++this.roleRun
    this.set({ status: 'signed-in', email: result.session.email, roleStatus: 'checking', sessionExpired: false })
    try {
      const role = await this.backend.fetchRole(result.session.userId)
      if (run !== this.roleRun) return { ok: false, error: 'role_error' }
      if (role === 'admin') {
        this.set({ roleStatus: 'admin' })
        return { ok: true }
      }
      await this.signOutQuietly()
      return { ok: false, error: 'not_admin' }
    } catch {
      await this.signOutQuietly()
      return { ok: false, error: 'role_error' }
    }
  }

  async logout(): Promise<void> {
    await this.signOutQuietly()
  }

  /** Re-runs the role check after a failure (for the "try again" button). */
  retryRole(): void {
    if (this.snapshot.status === 'signed-in' && this.userId) void this.verifyRole(this.userId)
  }

  // ---- internals ----------------------------------------------------------------------------------------------------------
  private async signOutQuietly(): Promise<void> {
    this.signingOut = true
    try {
      await this.backend.signOut()
    } catch {
      // The local session is cleared regardless; failing to reach the server must not keep the admin UI open.
    } finally {
      this.signingOut = false
    }
    this.clearUser(false)
  }

  private onEvent(event: AuthEvent, session: BackendSession | null): void {
    if (event === 'SIGNED_OUT' || (!session && event !== 'INITIAL_SESSION')) {
      // Not asked for by this controller: the session expired, was revoked or was removed elsewhere.
      const hadUser = this.userId !== null
      this.clearUser(hadUser && !this.signingOut)
      return
    }
    if (!session) {
      this.clearUser(false)
      return
    }
    // Do NOT call the backend from inside its own auth callback (it can deadlock); defer to the next macrotask.
    const refreshed = event === 'TOKEN_REFRESHED' || event === 'USER_UPDATED'
    const epoch = this.epoch
    setTimeout(() => {
      if (epoch === this.epoch) this.adopt(session, refreshed)
    }, 0)
  }

  /** Takes a session from the backend. Verifies the role when the user changed, or when asked to re-verify. */
  private adopt(session: BackendSession | null, forceVerify = false): void {
    if (!session) {
      this.clearUser(false)
      return
    }
    const sameUser = this.userId === session.userId
    this.userId = session.userId
    if (!sameUser) this.set({ status: 'signed-in', email: session.email, roleStatus: 'checking', sessionExpired: false })
    else if (this.snapshot.status !== 'signed-in') this.set({ status: 'signed-in', email: session.email })
    const needsCheck = !sameUser || forceVerify || this.snapshot.roleStatus === 'unknown' || this.snapshot.roleStatus === 'error'
    // A re-check of an already verified administrator keeps the admin UI up; it only takes it down if the answer changes.
    if (needsCheck && !(sameUser && this.snapshot.roleStatus === 'checking')) void this.verifyRole(session.userId, sameUser && this.snapshot.roleStatus === 'admin')
  }

  private async verifyRole(userId: string, quiet = false): Promise<void> {
    const run = ++this.roleRun
    if (!quiet) this.set({ roleStatus: 'checking' })
    try {
      const role = await this.backend.fetchRole(userId)
      if (run !== this.roleRun || this.userId !== userId) return // a newer check or a different user superseded this answer
      this.set({ roleStatus: role === 'admin' ? 'admin' : 'not-admin' })
    } catch {
      if (run !== this.roleRun || this.userId !== userId) return
      // A failed background re-check of a verified administrator keeps the panel open (the database still enforces
      // every permission); a failed first check denies access and offers a retry.
      if (!quiet) this.set({ roleStatus: 'error' })
    }
  }

  private clearUser(expired: boolean): void {
    const hadUser = this.userId !== null
    this.userId = null
    this.roleRun += 1
    this.epoch += 1
    this.set({ status: 'signed-out', roleStatus: 'unknown', email: null, sessionExpired: expired })
    if (hadUser) this.hooks.onSignedOut?.()
  }

  private set(patch: Partial<AuthSnapshot>): void {
    const next = { ...this.snapshot, ...patch }
    const same = (Object.keys(next) as (keyof AuthSnapshot)[]).every((k) => next[k] === this.snapshot[k])
    if (same) return
    this.snapshot = next // a new object only when something changed, so subscribers re-render only when needed
    this.listeners.forEach((l) => l())
  }
}
