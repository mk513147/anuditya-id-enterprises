import { Loader2, ShieldAlert } from 'lucide-react'
import type { ReactNode } from 'react'
import { Link, Navigate, useLocation } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { adminGuardDecision } from './guard'
import { useAuth } from './useAuth'

function Screen({ children, label }: { children: ReactNode; label: string }) {
  return (
    <main aria-label={label} className="grid min-h-svh place-items-center bg-surface p-6">
      <div className="w-full max-w-md rounded-[var(--radius-card)] border bg-white p-8 text-center shadow-card">{children}</div>
    </main>
  )
}

/**
 * Keeps the administrator area closed until the signed-in user's role has been verified.
 * This is a user-interface gate only: the database enforces the real permissions.
 */
export function RequireAdmin({ children }: { children: ReactNode }) {
  const { snapshot, logout, retryRole } = useAuth()
  const location = useLocation()
  const decision = adminGuardDecision(snapshot)

  switch (decision) {
    case 'allow':
      return <>{children}</>
    case 'loading':
      return (
        <Screen label="Checking your session">
          <div role="status" aria-live="polite" className="flex flex-col items-center gap-3 text-muted-ink">
            <Loader2 className="size-8 animate-spin text-royal-600" aria-hidden />
            <p>Checking your session…</p>
          </div>
        </Screen>
      )
    case 'login':
      return <Navigate to="/login" replace state={{ from: `${location.pathname}${location.search}`, expired: snapshot.sessionExpired }} />
    case 'forbidden':
      return (
        <Screen label="Not authorised">
          <ShieldAlert className="mx-auto size-10 text-destructive" aria-hidden />
          <h1 className="mt-3 text-xl font-bold">You do not have access to the admin area</h1>
          <p className="mt-2 text-sm text-muted-ink">This account is signed in, but it is not the administrator account.</p>
          <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:justify-center">
            <Button onClick={() => void logout()}>Sign out</Button>
            <Button asChild variant="outline">
              <Link to="/">Back to the website</Link>
            </Button>
          </div>
        </Screen>
      )
    case 'role-error':
      return (
        <Screen label="Could not verify access">
          <div role="alert">
            <ShieldAlert className="mx-auto size-10 text-destructive" aria-hidden />
            <h1 className="mt-3 text-xl font-bold">We could not verify your access</h1>
            <p className="mt-2 text-sm text-muted-ink">Nothing is shown until your administrator access has been confirmed. Check your connection and try again.</p>
          </div>
          <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:justify-center">
            <Button onClick={retryRole}>Try again</Button>
            <Button variant="outline" onClick={() => void logout()}>
              Sign out
            </Button>
          </div>
        </Screen>
      )
    case 'not-configured':
      return (
        <Screen label="Sign-in unavailable">
          <ShieldAlert className="mx-auto size-10 text-destructive" aria-hidden />
          <h1 className="mt-3 text-xl font-bold">The admin area is not available</h1>
          <p className="mt-2 text-sm text-muted-ink">This site has not been connected to its authentication service, so nobody can sign in yet.</p>
          <Button asChild className="mt-6">
            <Link to="/">Back to the website</Link>
          </Button>
        </Screen>
      )
  }
}
