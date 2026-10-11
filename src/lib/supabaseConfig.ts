/**
 * Validation of the PUBLIC Supabase settings that are compiled into the browser bundle.
 * Pure (no environment access, no network), so it can be tested and shared.
 */
export type SupabaseConfigResult =
  | { ok: true; url: string; key: string }
  | { ok: false; reason: 'missing' | 'invalid_url' | 'insecure_url' | 'privileged_key' | 'unrecognised_key' }

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
  // Refuse a privileged key outright: it would be shipped to every visitor.
  if (isPrivilegedKey(key)) return { ok: false, reason: 'privileged_key' }
  if (!(key.startsWith('sb_publishable_') || key.startsWith('eyJ') || LOCAL_HOSTS.has(url.hostname))) return { ok: false, reason: 'unrecognised_key' }
  return { ok: true, url: baseUrl, key }
}
