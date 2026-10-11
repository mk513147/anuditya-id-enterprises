import type { LoginResult } from './authController'

/** User-facing text for each way a sign-in can fail. Deliberately vague about WHY credentials were rejected. */
export function loginErrorMessage(error: Extract<LoginResult, { ok: false }>['error']): string {
  switch (error) {
    case 'invalid':
      return 'The email or password is not correct.'
    case 'rate_limited':
      return 'Too many sign-in attempts. Please wait a few minutes and try again.'
    case 'network':
      return 'Could not reach the sign-in service. Check your connection and try again.'
    case 'not_configured':
      return 'Sign-in is not available yet: this site has not been connected to its authentication service.'
    case 'not_admin':
      return 'This account is not authorised for the administrator area.'
    case 'role_error':
      return 'Your sign-in worked, but we could not confirm administrator access, so you have been signed out. Please try again.'
    default:
      return 'Something went wrong while signing in. Please try again.'
  }
}
