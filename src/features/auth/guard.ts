import type { AuthSnapshot } from './authController'

/**
 * What the admin route guard should do for a given state. A pure function so every case is tested.
 * Privileged content is shown ONLY for 'allow', never while loading, checking, failed or denied.
 */
export type GuardDecision = 'loading' | 'login' | 'forbidden' | 'role-error' | 'not-configured' | 'allow'

export function adminGuardDecision(s: AuthSnapshot): GuardDecision {
  if (!s.configured) return 'not-configured'
  if (s.status === 'loading') return 'loading'
  if (s.status === 'signed-out') return 'login'
  switch (s.roleStatus) {
    case 'admin':
      return 'allow'
    case 'not-admin':
      return 'forbidden'
    case 'error':
      return 'role-error'
    default:
      return 'loading' // unknown or checking: the role is not known yet
  }
}

/** Only same-site admin paths are honoured as a post-login destination (no open redirects). */
export function safeAdminDestination(from: unknown): string {
  return typeof from === 'string' && /^\/admin(\/[A-Za-z0-9._~!$&'()*+,;=:@%/-]*)?(\?[^\s#]*)?$/.test(from) && !from.includes('//') ? from : '/admin'
}
