#!/usr/bin/env node
/**
 * Read-only verification of the public Supabase Data API surface (anonymous role only).
 *
 *   SUPABASE_URL=https://<project-ref>.supabase.co  SUPABASE_ANON_KEY=<publishable or anon key>  node verify-public-api.mjs
 *
 * What it does: a handful of GET reads (limit 1) and POST calls to a fixed allow-list of RPCs, using ONLY the project
 * URL and the publishable/anonymous key. It never inserts, updates or deletes anything, never uploads files, never uses
 * a service-role or secret key (it refuses to start if it recognises one), and never prints the key.
 *
 * Verdicts: PASS (the wanted behaviour was observed), FAIL (private data returned, or a call that must be denied
 * succeeded), INCONCLUSIVE (nothing bad seen but it proves nothing, for example an empty table) and UNEXPECTED
 * (network error or an odd response). Status codes are reported as observations. Exit code: 0 all pass, 1 any FAIL,
 * 3 no FAIL but something inconclusive/unexpected, 2 refused to start.
 */
import { randomBytes } from 'node:crypto'

const OPT_CHECK_GET_REFUSED = process.argv.includes('--check-get-refused')
const OPT_ALLOW_HTTP = process.argv.includes('--allow-http-localhost')

// ---------------------------------------------------------------------------------------------------- configuration
const baseUrl = (process.env.SUPABASE_URL ?? '').trim().replace(/\/+$/, '')
const apiKey = (process.env.SUPABASE_ANON_KEY ?? '').trim()

function fatal(message) {
  console.error(`ABORT: ${message}`)
  process.exit(2)
}

if (!baseUrl || !apiKey) fatal('set SUPABASE_URL and SUPABASE_ANON_KEY (publishable/anon key only).')
let url
try { url = new URL(baseUrl) } catch { fatal('SUPABASE_URL is not a valid URL.') }
const isLocal = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)
if (url.protocol !== 'https:' && !(OPT_ALLOW_HTTP && isLocal)) fatal('SUPABASE_URL must be https (http is allowed only for localhost with --allow-http-localhost).')
if (url.search || url.username || url.password) fatal('SUPABASE_URL must be the bare project URL.')

// Refuse anything that looks like a privileged key. Decoding is local; nothing is printed.
function looksPrivileged(key) {
  if (key.startsWith('sb_secret_')) return true
  if (!key.startsWith('eyJ')) return false
  try {
    const payload = JSON.parse(Buffer.from(key.split('.')[1], 'base64url').toString('utf8'))
    return payload.role !== undefined && payload.role !== 'anon'
  } catch { return false }
}
if (looksPrivileged(apiKey)) fatal('that key is not an anonymous/publishable key. Never use a secret or service-role key here.')
if (!(apiKey.startsWith('sb_publishable_') || apiKey.startsWith('eyJ') || isLocal)) fatal('the key does not look like a publishable or anon key.')

// ---------------------------------------------------------------------------------------------------- safe HTTP
const READ_TABLES = ['students', 'orders', 'profiles', 'uploaded_files']
// Every POST must target one of these RPCs. Nothing else can be called, so nothing can be written by accident.
const RPC_ALLOW = new Set(['list_enabled_services', 'admin_create_order', 'admin_review_student', 'admin_rotate_tracking_code', 'admin_set_order_status', 'track_order', 'is_admin'])
const NIL_UUID = '00000000-0000-0000-0000-000000000000'

const redact = (text) => String(text).split(apiKey).join('[redacted-key]')

async function send(method, path, { body, headers = {} } = {}) {
  if (method !== 'GET' && method !== 'POST') throw new Error(`method ${method} is not allowed in this script`)
  if (method === 'POST' && !(path.startsWith('/rest/v1/rpc/') && RPC_ALLOW.has(path.slice('/rest/v1/rpc/'.length)))) throw new Error('POST is only allowed to the RPC allow-list')
  if (method === 'GET' && !(path.startsWith('/rest/v1/') && !path.includes('/rpc/') || path === '/rest/v1/rpc/track_order')) throw new Error('GET is only allowed on tables (and the optional no-parameter function check)')
  const h = { apikey: apiKey, Accept: 'application/json', ...headers }
  if (apiKey.startsWith('eyJ')) h.Authorization = `Bearer ${apiKey}` // legacy anon keys are JWTs; publishable keys are sent as apikey only
  if (method === 'POST') h['Content-Type'] = 'application/json'
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 20_000)
  try {
    const res = await fetch(baseUrl + path, { method, headers: h, body: body === undefined ? undefined : JSON.stringify(body), signal: controller.signal })
    const raw = await res.text()
    let json
    try { json = raw ? JSON.parse(raw) : undefined } catch { json = undefined }
    return { status: res.status, json, rawLength: raw.length }
  } catch (e) {
    return { status: 0, error: redact(e?.name === 'AbortError' ? 'timeout' : (e?.message ?? 'network error')) }
  } finally {
    clearTimeout(timer)
  }
}

/** Safe, short description of an error body (PostgREST error code and message only; never any row data). */
function errorOf(r) {
  if (r.error) return `network:${r.error}`
  const j = r.json
  if (j && !Array.isArray(j) && typeof j === 'object' && (j.code || j.message)) return `${j.code ?? ''} ${String(j.message ?? '').slice(0, 70)}`.trim()
  return ''
}
const rowCount = (r) => (Array.isArray(r.json) ? r.json.length : r.json && typeof r.json === 'object' && !(r.json.code || r.json.message) ? 1 : 0)

// ---------------------------------------------------------------------------------------------------- reporting
// Verdicts (a status code alone never decides a verdict, except where stated):
//   PASS          the behaviour we wanted was observed directly (for example an explicit permission denial).
//   FAIL          private data was returned, or a call that must be denied succeeded.
//   INCONCLUSIVE  nothing bad was seen, but the observation cannot prove the claim (for example an empty table).
//   UNEXPECTED    network error or a response that does not fit any expectation; investigate before trusting anything.
const results = []
function report(verdict, name, r, note = '') {
  results.push(verdict)
  const bits = [`HTTP ${r?.status ?? '-'}`]
  if (r && 'json' in r) bits.push(`rows returned: ${rowCount(r)}`)
  const err = r ? errorOf(r) : ''
  if (err) bits.push(`error: ${err}`)
  console.log(`[${verdict}] ${name}\n       ${redact(bits.join(' | '))}${note ? `\n       ${redact(note)}` : ''}`)
}

const is2xx = (r) => r.status >= 200 && r.status < 300
const isNetworkError = (r) => r.status === 0
/** An explicit permission denial: HTTP 401/403, or PostgREST reporting SQLSTATE 42501 (insufficient privilege). */
const isDenied = (r) => r.status === 401 || r.status === 403 || (r.json && !Array.isArray(r.json) && r.json.code === '42501')
/** PostgREST could not find the relation or function (not deployed, not exposed to this role, or wrong arguments). */
const isNotFound = (r) => r.status === 404 || (r.json && !Array.isArray(r.json) && ['PGRST202', 'PGRST205'].includes(r.json.code))

// ---------------------------------------------------------------------------------------------------- checks
console.log(`Public API verification (anonymous role, read-only)\nTarget: ${url.protocol}//${url.hostname.replace(/^(.{4}).*(\..*)$/, '$1…$2')}\n`)

console.log('1) Direct reads of private tables (GET, select=id, limit=1)')
for (const table of READ_TABLES) {
  const r = await send('GET', `/rest/v1/${table}?select=id&limit=1`)
  const name = `GET ${table}`
  if (isNetworkError(r)) report('UNEXPECTED', name, r, 'network error: nothing was learned.')
  else if (is2xx(r) && rowCount(r) > 0) report('FAIL', name, r, 'PRIVATE ROWS WERE RETURNED.')
  else if (isDenied(r)) report('PASS', name, r, 'explicitly denied.')
  else if (is2xx(r) && Array.isArray(r.json)) {
    report('INCONCLUSIVE', name, r, 'success with no rows. If this table is empty that proves nothing about access (an empty table returns no rows even when SELECT is allowed). Use the has_table_privilege query in docs/supabase/testing.md, or test with a row present.')
  } else report('UNEXPECTED', name, r, 'neither a denial nor an empty success. A 404 here usually means the table is not deployed or not exposed.')
}

console.log('\n2) Public RPC list_enabled_services must be callable (POST)')
{
  const r = await send('POST', '/rest/v1/rpc/list_enabled_services', { body: {} })
  const name = 'POST list_enabled_services'
  if (isNetworkError(r)) report('UNEXPECTED', name, r, 'network error.')
  else if (is2xx(r) && Array.isArray(r.json)) {
    const allowedKeys = new Set(['id', 'slug', 'title', 'tagline', 'category', 'description', 'image_url', 'icon', 'display_order'])
    const stray = [...new Set(r.json.flatMap((row) => Object.keys(row)))].filter((k) => !allowedKeys.has(k))
    if (stray.length) report('FAIL', name, r, `unexpected columns in the response: ${stray.join(', ')}`)
    else report('PASS', name, r, r.json.length ? 'callable; only the expected columns were returned.' : 'callable. The list is empty, so the returned column names could not be checked.')
  } else if (isNotFound(r)) report('INCONCLUSIVE', name, r, 'function not found: the migrations may not be applied yet.')
  else report('UNEXPECTED', name, r, 'not callable, for a reason other than "not found".')
}

console.log('\n3) Administrator RPCs must not succeed for an anonymous caller (POST; dummy arguments that match nothing)')
const adminCalls = [
  ['admin_create_order', { p_school_id: null, p_customer_name: 'verification', p_service: 'verification', p_quantity: 1, p_order_date: '2000-01-01', p_expected_delivery: '2000-01-02', p_internal_notes: null }],
  ['admin_review_student', { p_student_id: NIL_UUID, p_decision: 'approved' }],
  ['admin_rotate_tracking_code', { p_order_id: NIL_UUID }],
  ['admin_set_order_status', { p_order_id: NIL_UUID, p_status: 'Printing' }],
]
for (const [fn, body] of adminCalls) {
  const r = await send('POST', `/rest/v1/rpc/${fn}`, { body })
  const name = `POST ${fn}`
  if (isNetworkError(r)) report('UNEXPECTED', name, r, 'network error.')
  else if (is2xx(r)) report('FAIL', name, r, 'THE ANONYMOUS CALL SUCCEEDED.')
  else if (isDenied(r)) report('PASS', name, r, 'explicitly denied.')
  else if (isNotFound(r)) report('INCONCLUSIVE', name, r, 'function not found for this caller. That is consistent with a missing EXECUTE grant, but equally with the migration not being applied or the arguments not matching, so it does not prove denial. Use the has_function_privilege query in docs/supabase/testing.md.')
  else report('UNEXPECTED', name, r, 'rejected, but not as a clear permission denial.')
}

console.log('\n4) track_order with INVALID credentials must reveal nothing (POST + JSON body; no URL parameters)')
const randomCode = () => { const a = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; const b = randomBytes(25); return Array.from(b, (x, i) => a[x & 31] + (i % 5 === 4 && i < 24 ? '-' : '')).join('') }
const trackCases = [
  ['unknown order number + random well-formed code', { p_order_no: 'JOB-0000-0000', p_tracking_code: randomCode() }],
  ['malformed code', { p_order_no: 'JOB-0000-0000', p_tracking_code: 'not-a-code' }],
  ['empty values', { p_order_no: '', p_tracking_code: '' }],
]
for (const [label, body] of trackCases) {
  const r = await send('POST', '/rest/v1/rpc/track_order', { body })
  const name = `POST track_order (${label})`
  if (isNetworkError(r)) report('UNEXPECTED', name, r, 'network error.')
  else if (is2xx(r) && rowCount(r) > 0) report('FAIL', name, r, 'ORDER DATA WAS RETURNED.')
  else if (is2xx(r) && Array.isArray(r.json)) report('PASS', name, r, 'no order data revealed. Note: with no orders in the database this cannot show that the secret is enforced; the database tests cover that.')
  else if (isNotFound(r)) report('INCONCLUSIVE', name, r, 'function not found: the migrations may not be applied yet.')
  else report('UNEXPECTED', name, r, 'neither an empty result nor "not found".')
}

console.log('\n5) PRELIMINARY: is the private schema reachable through the Data API? (POST is_admin with Content-Profile: private)')
{
  const r = await send('POST', '/rest/v1/rpc/is_admin', { body: {}, headers: { 'Content-Profile': 'private' } })
  const name = 'POST private.is_admin (preliminary probe)'
  if (isNetworkError(r)) report('UNEXPECTED', name, r, 'network error.')
  else if (is2xx(r)) report('FAIL', name, r, 'THE CALL SUCCEEDED, so the private schema appears to be exposed. Remove it from Settings > API > Exposed schemas.')
  else {
    const hint = r.json && r.json.code === 'PGRST106' ? 'PostgREST reported an invalid schema, which is the response it gives for a schema that is not exposed.' : 'the response does not name the reason.'
    report('INCONCLUSIVE', name, r, `Preliminary evidence only. A non-2xx response does not prove the schema is unexposed: it could equally be a permission error or a missing function. ${hint} Confirm in Dashboard > Settings > API > Exposed schemas.`)
  }
}

if (OPT_CHECK_GET_REFUSED) {
  console.log('\n6) Optional: a GET to track_order must be refused (no parameters, so no credentials in the URL)')
  const r = await send('GET', '/rest/v1/rpc/track_order')
  const name = 'GET track_order (no parameters)'
  if (isNetworkError(r)) report('UNEXPECTED', name, r, 'network error.')
  else if (is2xx(r)) report('FAIL', name, r, 'GET IS ACCEPTED, so the function is not VOLATILE and a code could travel in a URL.')
  else if (r.status === 405) report('PASS', name, r, 'GET refused as "method not allowed", the expected behaviour for a volatile function.')
  else report('INCONCLUSIVE', name, r, 'GET did not succeed, but not with a clear "method not allowed", so this does not prove the function is volatile.')
}

const count = (v) => results.filter((x) => x === v).length
console.log(`\n${results.length} checks: ${count('PASS')} PASS, ${count('FAIL')} FAIL, ${count('INCONCLUSIVE')} INCONCLUSIVE, ${count('UNEXPECTED')} UNEXPECTED.`)
console.log('No data was written; the key was never printed. INCONCLUSIVE is not a pass: follow the notes above.')
// Exit codes: 0 = everything passed; 1 = at least one FAIL; 3 = no FAIL but something INCONCLUSIVE/UNEXPECTED; 2 = refused to start.
process.exit(count('FAIL') ? 1 : count('INCONCLUSIVE') + count('UNEXPECTED') ? 3 : 0)
