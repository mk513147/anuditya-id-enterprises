/**
 * Configuration for the read-only public API verification. Pure functions (plus one file read), no network, and nothing
 * here ever returns or prints a configured VALUE in a message: only variable NAMES and problem descriptions.
 *
 * Resolution order, per setting (URL and key independently):
 *   1. the process environment: SUPABASE_URL / SUPABASE_ANON_KEY (explicitly supplied values always win);
 *   2. <repo root>/.env.local: VITE_SUPABASE_URL / VITE_SUPABASE_PUBLISHABLE_KEY (the names the app already uses);
 *   3. <repo root>/.env.local: SUPABASE_URL / SUPABASE_ANON_KEY.
 * Blank values count as missing. The file never overrides the process environment and is never written to process.env.
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { parseEnv } from 'node:util'

/** The repository root, from this file's location (supabase/verification/lib), not from the terminal's directory. */
export const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..')

export const SOURCES = {
  url: { process: ['SUPABASE_URL'], file: ['VITE_SUPABASE_URL', 'SUPABASE_URL'] },
  key: { process: ['SUPABASE_ANON_KEY'], file: ['VITE_SUPABASE_PUBLISHABLE_KEY', 'SUPABASE_ANON_KEY'] },
}

/**
 * Reads a dotenv file with Node's own parser (comments, blank lines, whitespace, single/double/backtick quotes).
 * A missing file is normal; an unreadable or unparsable one is reported without its contents.
 */
export function readEnvFile(file = path.join(REPO_ROOT, '.env.local')) {
  if (!fs.existsSync(file)) return { exists: false, values: {}, error: null }
  try {
    return { exists: true, values: parseEnv(fs.readFileSync(file, 'utf8')), error: null }
  } catch (e) {
    return { exists: true, values: {}, error: e?.code === 'EACCES' ? 'the file could not be read (permission denied)' : 'the file could not be parsed' }
  }
}

const present = (v) => typeof v === 'string' && v.trim() !== ''

/** Picks each setting from its first non-blank source. Returns values plus where they came from (names only). */
export function resolveConfig(processEnv, fileValues) {
  const pick = ({ process: pNames, file: fNames }) => {
    for (const n of pNames) if (present(processEnv[n])) return { value: processEnv[n].trim(), source: `process environment ${n}` }
    for (const n of fNames) if (present(fileValues[n])) return { value: fileValues[n].trim(), source: `.env.local ${n}` }
    return { value: '', source: null }
  }
  const url = pick(SOURCES.url)
  const key = pick(SOURCES.key)
  const missing = []
  if (!url.source) missing.push(`${SOURCES.url.process.join('/')} (environment) or ${SOURCES.url.file.join(' / ')} (.env.local)`)
  if (!key.source) missing.push(`${SOURCES.key.process.join('/')} (environment) or ${SOURCES.key.file.join(' / ')} (.env.local)`)
  return { url: url.value, key: key.value, urlSource: url.source, keySource: key.source, missing }
}

const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]'])

/** True for a secret key or a JWT whose role is not "anon". Decoding is local and nothing is returned or printed. */
export function looksPrivileged(key) {
  if (/^sb_secret_/i.test(key)) return true
  if (!key.startsWith('eyJ')) return false
  try {
    const payload = JSON.parse(Buffer.from(key.split('.')[1], 'base64url').toString('utf8'))
    return payload.role !== undefined && payload.role !== 'anon'
  } catch {
    return false
  }
}

/**
 * Validates the settings for ANONYMOUS verification. Problems are described without echoing the values.
 * Returns { ok: true, origin, isLocal } or { ok: false, problems: string[] }.
 */
export function validateConfig(rawUrl, key, { allowHttpLocalhost = false } = {}) {
  const problems = []
  let url = null
  try {
    url = new URL(rawUrl.trim())
  } catch {
    problems.push('the project URL is not a valid URL (expected https://<project-ref>.supabase.co).')
  }
  const isLocal = !!url && LOCAL_HOSTS.has(url.hostname)
  if (url) {
    if (url.protocol !== 'https:' && url.protocol !== 'http:') problems.push('the project URL must use https.')
    else if (url.protocol === 'http:' && !(allowHttpLocalhost && isLocal)) problems.push('the project URL must use https (http is allowed only for localhost with --allow-http-localhost).')
    if (url.pathname !== '/' && url.pathname !== '') problems.push('the project URL must be the bare origin with no path (remove anything such as /rest/v1).')
    if (url.search) problems.push('the project URL must not contain a query string.')
    if (url.hash) problems.push('the project URL must not contain a fragment.')
    if (url.username || url.password) problems.push('the project URL must not contain credentials.')
  }
  if (!present(key)) problems.push('the anon/publishable key is empty.')
  else if (looksPrivileged(key.trim())) problems.push('the key is a secret or service-role key. This script only ever uses the anon/publishable key; never supply a privileged key.')
  else if (!(key.trim().startsWith('sb_publishable_') || key.trim().startsWith('eyJ') || isLocal)) problems.push('the key does not look like a publishable (sb_publishable_...) or legacy anon key.')
  return problems.length ? { ok: false, problems } : { ok: true, origin: url.origin, isLocal }
}
