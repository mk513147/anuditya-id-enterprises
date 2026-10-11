import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import { LoginPage } from '@/pages/LoginPage'
import { loginSchema } from '@/validations/login'
import type { AuthSnapshot } from './authController'
import { AuthContext, type AuthContextValue } from './authContext'
import { adminGuardDecision, safeAdminDestination } from './guard'
import { loginErrorMessage } from './loginMessages'
import { RequireAdmin } from './RequireAdmin'

const snap = (over: Partial<AuthSnapshot> = {}): AuthSnapshot => ({ status: 'signed-out', roleStatus: 'unknown', email: null, sessionExpired: false, configured: true, ...over })
const ctx = (snapshot: AuthSnapshot): AuthContextValue => ({ snapshot, login: async () => ({ ok: true }), logout: async () => {}, retryRole: () => {} })
const render = (snapshot: AuthSnapshot, node: React.ReactNode, path = '/admin') =>
  renderToStaticMarkup(
    <MemoryRouter initialEntries={[path]}>
      <AuthContext.Provider value={ctx(snapshot)}>{node}</AuthContext.Provider>
    </MemoryRouter>,
  )
const SECRET = 'PRIVILEGED ADMIN CONTENT'
const guarded = (snapshot: AuthSnapshot) => render(snapshot, <RequireAdmin><p>{SECRET}</p></RequireAdmin>)

describe('admin guard decisions', () => {
  it('maps every state to exactly one outcome, and only an administrator is allowed', () => {
    expect(adminGuardDecision(snap({ status: 'loading' }))).toBe('loading')
    expect(adminGuardDecision(snap({ status: 'signed-out' }))).toBe('login')
    expect(adminGuardDecision(snap({ status: 'signed-in', roleStatus: 'unknown' }))).toBe('loading')
    expect(adminGuardDecision(snap({ status: 'signed-in', roleStatus: 'checking' }))).toBe('loading')
    expect(adminGuardDecision(snap({ status: 'signed-in', roleStatus: 'not-admin' }))).toBe('forbidden')
    expect(adminGuardDecision(snap({ status: 'signed-in', roleStatus: 'error' }))).toBe('role-error')
    expect(adminGuardDecision(snap({ status: 'signed-in', roleStatus: 'admin' }))).toBe('allow')
    expect(adminGuardDecision(snap({ configured: false }))).toBe('not-configured')
  })

  it('never allows access without a verified administrator, whatever else is true', () => {
    for (const status of ['loading', 'signed-out', 'signed-in'] as const) {
      for (const roleStatus of ['unknown', 'checking', 'not-admin', 'error'] as const) {
        expect(adminGuardDecision(snap({ status, roleStatus })), `${status}/${roleStatus}`).not.toBe('allow')
      }
    }
    expect(adminGuardDecision(snap({ status: 'signed-out', roleStatus: 'admin' }))).not.toBe('allow')
    expect(adminGuardDecision(snap({ status: 'loading', roleStatus: 'admin' }))).not.toBe('allow')
    expect(adminGuardDecision(snap({ configured: false, status: 'signed-in', roleStatus: 'admin' }))).not.toBe('allow')
  })

  it('only honours same-site admin paths as a post-login destination', () => {
    expect(safeAdminDestination('/admin/students?page=2')).toBe('/admin/students?page=2')
    expect(safeAdminDestination('/admin')).toBe('/admin')
    for (const bad of ['https://evil.example', '//evil.example', '/other', '/administrator', '/admin//evil.example', 'javascript:alert(1)', undefined, 7, '', '/admin\\evil']) {
      expect(safeAdminDestination(bad), String(bad)).toBe('/admin')
    }
  })
})

describe('RequireAdmin rendering', () => {
  it('shows privileged content ONLY to a verified administrator', () => {
    expect(guarded(snap({ status: 'signed-in', roleStatus: 'admin' }))).toContain(SECRET)
  })

  it('never renders privileged content while loading or checking, and announces the wait', () => {
    for (const s of [snap({ status: 'loading' }), snap({ status: 'signed-in', roleStatus: 'checking' }), snap({ status: 'signed-in', roleStatus: 'unknown' })]) {
      const html = guarded(s)
      expect(html).not.toContain(SECRET)
      expect(html).toContain('Checking your session')
      expect(html).toContain('role="status"')
    }
  })

  it('shows a clear "no access" screen with sign-out to an authenticated non-administrator, and no content', () => {
    const html = guarded(snap({ status: 'signed-in', roleStatus: 'not-admin', email: 'x@example.invalid' }))
    expect(html).not.toContain(SECRET)
    expect(html).toContain('You do not have access to the admin area')
    expect(html).toContain('Sign out')
  })

  it('shows a retry screen, and no content, when the role could not be verified', () => {
    const html = guarded(snap({ status: 'signed-in', roleStatus: 'error' }))
    expect(html).not.toContain(SECRET)
    expect(html).toContain('We could not verify your access')
    expect(html).toContain('Try again')
    expect(html).toContain('role="alert"')
  })

  it('shows nothing privileged when sign-in is not configured', () => {
    const html = guarded(snap({ configured: false }))
    expect(html).not.toContain(SECRET)
    expect(html).toContain('The admin area is not available')
  })

  it('an unauthenticated visitor gets no privileged content (the redirect to /login happens on render)', () => {
    expect(guarded(snap({ status: 'signed-out' }))).not.toContain(SECRET)
    expect(adminGuardDecision(snap({ status: 'signed-out' }))).toBe('login')
  })
})

describe('login page', () => {
  const page = (s: AuthSnapshot, path = '/login') => render(s, <LoginPage />, path)

  it('has an email and password form and offers NO sign-up, registration or password-reset route', () => {
    const html = page(snap())
    expect(html).toContain('type="email"')
    expect(html).toContain('type="password"')
    expect(html).toContain('autoComplete="current-password"')
    expect(html).toContain('Sign in')
    expect(html).not.toMatch(/sign ?up|register|create (an )?account|forgot|reset (your )?password/i)
  })

  it('does not flash the form while the session is being checked', () => {
    const html = page(snap({ status: 'loading' }))
    expect(html).toContain('Checking your session')
    expect(html).not.toContain('type="password"')
  })

  it('tells a signed-in non-administrator they are not authorised, and offers sign-out instead of a loop', () => {
    const html = page(snap({ status: 'signed-in', roleStatus: 'not-admin' }))
    expect(html).toContain('not authorised for the administrator area')
    expect(html).toContain('Sign out')
    expect(html).not.toContain('type="password"')
  })

  it('does not render the form for an already verified administrator (it redirects to the panel)', () => {
    expect(page(snap({ status: 'signed-in', roleStatus: 'admin' }))).not.toContain('type="password"')
  })
})

describe('login form rules and messages', () => {
  it('requires a plausible email and a password', () => {
    expect(loginSchema.safeParse({ email: 'admin@example.com', password: 'x' }).success).toBe(true)
    expect(loginSchema.safeParse({ email: '', password: 'x' }).success).toBe(false)
    expect(loginSchema.safeParse({ email: 'not-an-email', password: 'x' }).success).toBe(false)
    expect(loginSchema.safeParse({ email: 'a@b.co', password: '' }).success).toBe(false)
  })

  it('explains each failure without revealing why credentials were rejected', () => {
    expect(loginErrorMessage('invalid')).toBe('The email or password is not correct.')
    expect(loginErrorMessage('rate_limited')).toMatch(/Too many/)
    expect(loginErrorMessage('network')).toMatch(/Could not reach/)
    expect(loginErrorMessage('not_configured')).toMatch(/not been connected/)
    expect(loginErrorMessage('not_admin')).toMatch(/not authorised/)
    expect(loginErrorMessage('role_error')).toMatch(/signed out/)
    expect(loginErrorMessage('unknown')).toMatch(/Something went wrong/)
    for (const e of ['invalid', 'not_admin'] as const) expect(loginErrorMessage(e)).not.toMatch(/no such|does not exist|wrong password|unknown user/i)
  })
})
