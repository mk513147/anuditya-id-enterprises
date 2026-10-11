/**
 * Chooses where the app's data comes from. Pure, so every combination can be tested.
 *
 *   VITE_DATA_SOURCE=supabase  → live data. If the Supabase settings are missing or invalid, every request fails with a
 *                                clear 'not_configured' error. It NEVER falls back to demo data.
 *   VITE_DATA_SOURCE=mock      → the in-memory demo data (explicit opt-in, e.g. a local demo). Labelled as demo data in the UI.
 *   unset                      → production builds: supabase (fail closed). Development: supabase when configured, else mock,
 *                                so `npm run dev` and the test suite work without credentials.
 *   anything else              → supabase (an unknown value is treated as a mistake, and mistakes must not show demo data).
 */
export type DataSource = 'supabase' | 'mock'

export interface DataSourceInputs {
  requested: string | undefined
  production: boolean
  configured: boolean
}

export function resolveDataSource({ requested, production, configured }: DataSourceInputs): DataSource {
  const value = (requested ?? '').trim().toLowerCase()
  if (value === 'mock') return 'mock'
  if (value === 'supabase') return 'supabase'
  if (value !== '') return 'supabase'
  if (production) return 'supabase'
  return configured ? 'supabase' : 'mock'
}
