import { createClient } from '@supabase/supabase-js'
import { validateSupabaseConfig } from './supabaseConfig'

/**
 * The ONE place the Supabase client is created. It uses the PUBLIC (publishable/anon) key only; a secret or
 * service-role key is refused outright (see supabaseConfig.ts). Without valid settings the client is null and the
 * administrator area stays closed; the public site keeps working on its own.
 *
 * Session storage: supabase-js keeps the signed-in session in the browser's localStorage (the only thing this app puts
 * there) so a refresh restores it, and refreshes the token automatically. Magic-link/OAuth URL parsing is switched off:
 * this app signs in with a password only.
 */
const config = validateSupabaseConfig(import.meta.env.VITE_SUPABASE_URL, import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY)

export const supabaseConfigProblem = config.ok ? null : config.reason

export const supabase = config.ok
  ? createClient(config.url, config.key, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false, storageKey: 'anuditya-admin-auth' },
    })
  : null
