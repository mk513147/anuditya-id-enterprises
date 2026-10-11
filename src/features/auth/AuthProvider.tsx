import { useQueryClient } from '@tanstack/react-query'
import { useEffect, useMemo, useState, useSyncExternalStore, type ReactNode } from 'react'
import { supabase } from '@/lib/supabase'
import { AuthController, type AuthBackend } from './authController'
import { AuthContext, type AuthContextValue } from './authContext'
import { createSupabaseBackend, type SupabaseAuthClient } from './supabaseBackend'

/**
 * Owns the single AuthController. The controller subscribes to Supabase once (reference-counted, so React StrictMode's
 * double mount does not create two subscriptions) and the provider exposes its state to the tree.
 * `backend` is injectable for tests; the app uses the real Supabase client.
 */
export function AuthProvider({ children, backend }: { children: ReactNode; backend?: AuthBackend }) {
  const queryClient = useQueryClient()
  const [controller] = useState(
    () => new AuthController(backend ?? createSupabaseBackend(supabase as unknown as SupabaseAuthClient | null), {
      // When the user goes away, drop cached data so the next person on this browser cannot see it.
      onSignedOut: () => queryClient.clear(),
    }),
  )

  useEffect(() => {
    controller.start()
    return () => controller.stop()
  }, [controller])

  const snapshot = useSyncExternalStore(controller.subscribe, controller.getSnapshot, controller.getSnapshot)

  const value = useMemo<AuthContextValue>(
    () => ({
      snapshot,
      login: (email, password) => controller.login(email, password),
      logout: () => controller.logout(),
      retryRole: () => controller.retryRole(),
    }),
    [controller, snapshot],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
