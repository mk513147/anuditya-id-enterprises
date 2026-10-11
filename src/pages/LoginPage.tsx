import { zodResolver } from '@hookform/resolvers/zod'
import { Loader2, LockKeyhole } from 'lucide-react'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { Navigate, useLocation, useNavigate } from 'react-router-dom'
import { FormField } from '@/components/shared/FormField'
import { PageHero } from '@/components/shared/PageHero'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { safeAdminDestination } from '@/features/auth/guard'
import { loginErrorMessage } from '@/features/auth/loginMessages'
import { useAuth } from '@/features/auth/useAuth'
import { usePageTitle } from '@/hooks/usePageTitle'
import { useSingleFlight } from '@/hooks/useSingleFlight'
import { loginSchema, type LoginFormValues } from '@/validations/login'

/**
 * Administrator sign-in. There is deliberately no sign-up, "create account" or password-reset link: the single
 * administrator account is created by the project owner (docs/supabase/admin-provisioning.md).
 */
export function LoginPage() {
  usePageTitle('Administrator Login')
  const { snapshot, login, logout } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const state = (location.state ?? {}) as { from?: unknown; expired?: unknown }
  const destination = safeAdminDestination(state.from)
  const singleFlight = useSingleFlight()
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginFormValues>({ resolver: zodResolver(loginSchema), mode: 'onTouched', defaultValues: { email: '', password: '' } })

  const onSubmit = handleSubmit((values) =>
    singleFlight(async () => {
      setError(null)
      setBusy(true)
      try {
        const result = await login(values.email, values.password)
        if (result.ok) navigate(destination, { replace: true })
        else setError(loginErrorMessage(result.error))
      } finally {
        setBusy(false)
      }
    }),
  )

  // Already signed in as the administrator: go straight to the panel (no form flash, no loop).
  if (snapshot.status === 'signed-in' && snapshot.roleStatus === 'admin') return <Navigate to={destination} replace />

  const signedInNotAdmin = snapshot.status === 'signed-in' && snapshot.roleStatus === 'not-admin'
  const checking = snapshot.status === 'loading' || (snapshot.status === 'signed-in' && snapshot.roleStatus === 'checking' && !busy)

  return (
    <>
      <PageHero breadcrumb="Login" eyebrow="Administrator only" title="Administrator Login" description="Sign in to manage schools, students, orders, files, offers and feedback." />
      <section className="container-page py-10 sm:py-14">
        <div className="mx-auto w-full max-w-md rounded-[var(--radius-card)] border bg-white p-6 shadow-card sm:p-8">
          <span className="mx-auto mb-4 grid size-12 place-items-center rounded-2xl bg-royal-100 text-royal-600">
            <LockKeyhole className="size-6" aria-hidden />
          </span>

          {state.expired === true && (
            <p role="status" className="mb-4 rounded-lg border border-gold-400/40 bg-gold-100 px-3 py-2 text-sm text-navy-900">
              Your session has ended. Please sign in again.
            </p>
          )}

          {signedInNotAdmin ? (
            <div role="alert" className="space-y-4 text-center">
              <p className="text-sm text-ink">This account is signed in, but it is not authorised for the administrator area.</p>
              <Button onClick={() => void logout()}>Sign out</Button>
            </div>
          ) : checking ? (
            <p role="status" aria-live="polite" className="flex items-center justify-center gap-2 py-6 text-muted-ink">
              <Loader2 className="size-5 animate-spin" aria-hidden /> Checking your session…
            </p>
          ) : (
            <form onSubmit={onSubmit} noValidate aria-busy={busy} className="space-y-1">
              {error && (
                <p role="alert" className="mb-3 rounded-lg border border-destructive/30 bg-red-50 px-3 py-2 text-sm text-destructive">
                  {error}
                </p>
              )}
              <FormField id="login-email" label="Email" required error={errors.email?.message}>
                {(c) => <Input {...c} {...register('email')} type="email" inputMode="email" autoComplete="username" autoCapitalize="none" spellCheck={false} className="h-11 text-base" />}
              </FormField>
              <FormField id="login-password" label="Password" required error={errors.password?.message}>
                {(c) => <Input {...c} {...register('password')} type="password" autoComplete="current-password" className="h-11 text-base" />}
              </FormField>
              <Button type="submit" size="lg" className="mt-2 w-full" disabled={busy}>
                {busy && <Loader2 className="animate-spin" aria-hidden />}
                {busy ? 'Signing in…' : 'Sign in'}
              </Button>
            </form>
          )}
        </div>
      </section>
    </>
  )
}
