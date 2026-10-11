/**
 * Validation of the PUBLIC Supabase settings that are compiled into the browser bundle.
 * Pure (no environment access, no network), so it can be tested and shared.
 */
export type SupabaseConfigProblem = 'missing' | 'invalid_url' | 'insecure_url' | 'url_has_path' | 'privileged_key' | 'unrecognised_key'

export type SupabaseConfigResult = { ok: true; url: string; key: string } | { ok: false; reason: SupabaseConfigProblem }

const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]'])

/** True for anything that is NOT an anonymous/publishable key: secret keys and JWTs whose role is not "anon". */
export function isPrivilegedKey(key: string): boolean {
  if (key.startsWith('sb_secret_')) return true
  if (!key.startsWith('eyJ')) return false
  try {
    const payload = JSON.parse(atob(key.split('.')[1].replace(/-/g, '+').replace(/_/g, '/'))) as { role?: string }
    return payload.role !== undefined && payload.role !== 'anon'
  } catch {
    return false
  }
}

export function validateSupabaseConfig(rawUrl: string | undefined, rawKey: string | undefined): SupabaseConfigResult {
  const baseUrl = (rawUrl ?? '').trim().replace(/\/+$/, '')
  const key = (rawKey ?? '').trim()
  if (!baseUrl || !key) return { ok: false, reason: 'missing' }
  let url: URL
  try {
    url = new URL(baseUrl)
  } catch {
    return { ok: false, reason: 'invalid_url' }
  }
  if (url.protocol !== 'https:' && !(url.protocol === 'http:' && LOCAL_HOSTS.has(url.hostname))) return { ok: false, reason: 'insecure_url' }
  // The project URL is a bare origin. A path such as /rest/v1 makes every request go to the wrong place (404s).
  if (url.pathname !== '/' || url.search || url.hash || url.username || url.password) return { ok: false, reason: 'url_has_path' }
  // Refuse a privileged key outright: it would be shipped to every visitor.
  if (isPrivilegedKey(key)) return { ok: false, reason: 'privileged_key' }
  if (!(key.startsWith('sb_publishable_') || key.startsWith('eyJ') || LOCAL_HOSTS.has(url.hostname))) return { ok: false, reason: 'unrecognised_key' }
  return { ok: true, url: url.origin, key }
}

/** Plain-language explanation for each problem. Never includes the configured values themselves. */
export const SUPABASE_CONFIG_MESSAGES: Record<SupabaseConfigProblem, string> = {
  missing: 'VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY must both be set.',
  invalid_url: 'VITE_SUPABASE_URL is not a valid URL.',
  insecure_url: 'VITE_SUPABASE_URL must use https (plain http is allowed only for localhost).',
  url_has_path: 'VITE_SUPABASE_URL must be the bare project URL (https://<project-ref>.supabase.co) with no path such as /rest/v1.',
  privileged_key: 'A secret or service-role key was supplied. Only the publishable (anon) key may be used in the browser.',
  unrecognised_key: 'VITE_SUPABASE_PUBLISHABLE_KEY does not look like a Supabase publishable key.',
}
