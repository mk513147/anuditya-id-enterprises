#!/usr/bin/env node
/**
 * Read-only verification of the public Supabase Data API surface (anonymous role only).
 *
 *   node supabase/verification/verify-public-api.mjs [--check-get-refused] [--order-no=JOB-2026-0001] [--allow-http-localhost]
 *
 * Configuration (see lib/config.mjs; values are never printed, only where they came from):
 *   1. SUPABASE_URL and SUPABASE_ANON_KEY from the process environment, when supplied;
 *   2. otherwise <repo root>/.env.local: VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY (the app's own names),
 *      or SUPABASE_URL / SUPABASE_ANON_KEY in that file.
 * Only the project URL and the publishable/anon key are ever used. A secret or service-role key is refused.
 *
 * What it does: GET reads (select=id, limit=1), POSTs to a fixed allow-list of read-only RPCs, and one storage LIST per
 * private bucket. It never inserts, updates or deletes anything, never uploads, and never calls a submit_* function.
 * Tracking checks use fabricated values only (random codes); real tracking codes are never requested or printed.
 * --order-no lets the operator name an order number that EXISTS (order numbers are not secret) so the script can show that
 * a wrong code is refused for a real order; without it that specific claim is reported as INCONCLUSIVE.
 *
 * Verdicts:
 *   PASS                 the intended behaviour was demonstrated.
 *   FAIL                 a security or functionality assertion was violated (private data returned, a forbidden call worked).
 *   INCONCLUSIVE         nothing bad was seen, but the response does not prove the claim. Never counted as a pass.
 *   UNEXPECTED           network error or a response that fits no expectation; investigate.
 *   CONFIGURATION ERROR  the checks could not start (missing/invalid settings, unreachable API, key rejected).
 * Exit code: 0 all PASS; 1 any FAIL; 3 no FAIL but something INCONCLUSIVE/UNEXPECTED; 2 CONFIGURATION ERROR.
 */
import { randomBytes } from 'node:crypto'
import { readEnvFile, resolveConfig, validateConfig } from './lib/config.mjs'

const OPT_CHECK_GET_REFUSED = process.argv.includes('--check-get-refused')
const OPT_ALLOW_HTTP = process.argv.includes('--allow-http-localhost')
const OPT_ORDER_NO = (process.argv.find((a) => a.startsWith('--order-no=')) ?? '').slice('--order-no='.length).trim().toUpperCase()

// ---------------------------------------------------------------------------------------------------- configuration
function configError(lines) {
  console.error('[CONFIGURATION ERROR] The checks could not start:')
  for (const l of [].concat(lines)) console.error(`  - ${l}`)
  console.error('Nothing was sent to the API. No value from the environment or .env.local was printed.')
  process.exit(2)
}

const envFile = readEnvFile()
if (envFile.error) configError(`.env.local: ${envFile.error}.`)
const cfg = resolveConfig(process.env, envFile.values)
if (cfg.missing.length) {
  configError([
    ...cfg.missing.map((m) => `missing: ${m}`),
    envFile.exists ? '.env.local was found but does not provide the missing setting(s) (blank values count as missing).' : '.env.local was not found at the repository root.',
  ])
}
const checked = validateConfig(cfg.url, cfg.key, { allowHttpLocalhost: OPT_ALLOW_HTTP })
if (!checked.ok) configError(checked.problems)
if (OPT_ORDER_NO && !/^[A-Z0-9][A-Z0-9-]{4,29}$/.test(OPT_ORDER_NO)) configError('--order-no must be an order number such as JOB-2026-0001.')

const baseUrl = checked.origin
const apiKey = cfg.key

// ---------------------------------------------------------------------------------------------------- safe HTTP
const READ_TABLES = ['students', 'orders', 'profiles', 'uploaded_files', 'uploaded_file_reviews', 'schools', 'order_status_history', 'services', 'advertisements', 'feedback']
// Every POST must target one of these read-only RPCs. No submit_* or other writing function can be called by accident.
const RPC_ALLOW = new Set([
  'list_enabled_services', 'list_active_schools', 'list_published_advertisements', 'list_approved_feedback', 'resolve_school',
  'admin_create_order', 'admin_review_student', 'admin_rotate_tracking_code', 'admin_set_order_status', 'admin_summary', 'admin_review_file',
  'track_order', 'is_admin',
])
const STORAGE_LIST_ALLOW = new Set(['student-photos', 'school-uploads'])
const NIL_UUID = '00000000-0000-0000-0000-000000000000'

/** Removes the key and the project URL from any text before it is printed. */
const redact = (text) => String(text).split(apiKey).join('[redacted-key]').split(baseUrl).join('[project-url]')

function assertAllowed(method, path) {
  if (method !== 'GET' && method !== 'POST') throw new Error(`method ${method} is not allowed in this script`)
  if (method === 'POST') {
    const rpc = path.startsWith('/rest/v1/rpc/') && RPC_ALLOW.has(path.slice('/rest/v1/rpc/'.length))
    const list = path.startsWith('/storage/v1/object/list/') && STORAGE_LIST_ALLOW.has(path.slice('/storage/v1/object/list/'.length))
    if (!rpc && !list) throw new Error('POST is only allowed to the read-only RPC allow-list and storage LIST')
  }
  if (method === 'GET' && !((path.startsWith('/rest/v1/') && !path.includes('/rpc/')) || path === '/rest/v1/rpc/track_order')) {
    throw new Error('GET is only allowed on tables (and the optional no-parameter function check)')
  }
}

async function send(method, path, { body, headers = {} } = {}) {
  assertAllowed(method, path)
  const h = { apikey: apiKey, Accept: 'application/json', ...headers }
  if (apiKey.startsWith('eyJ')) h.Authorization = `Bearer ${apiKey}` // legacy anon keys are JWTs; publishable keys are sent as apikey only
  if (method === 'POST') h['Content-Type'] = 'application/json'
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 20_000)
  try {
    const res = await fetch(baseUrl + path, { method, headers: h, body: body === undefined ? undefined : JSON.stringify(body), signal: controller.signal, redirect: 'manual' })
    const raw = await res.text()
    let json
    let malformed = false
    try { json = raw ? JSON.parse(raw) : undefined } catch { json = undefined; malformed = true }
    return { status: res.status, json, malformed, rawLength: raw.length }
  } catch (e) {
    // Only an error NAME/CODE is kept (e.g. ENOTFOUND, ECONNREFUSED, CERT_HAS_EXPIRED); never headers or the request.
    const code = e?.name === 'AbortError' ? 'timeout after 20 s' : (e?.cause?.code ?? e?.code ?? e?.name ?? 'network error')
    return { status: 0, error: redact(code) }
  } finally {
    clearTimeout(timer)
  }
}

/** Safe, short description of an error body (error code and message only; never any row data). */
function errorOf(r) {
  if (r.error) return `network: ${r.error}`
  if (r.malformed) return `non-JSON response (${r.rawLength} bytes)`
  const j = r.json
  if (j && !Array.isArray(j) && typeof j === 'object' && (j.code || j.message || j.error)) {
    return `${j.code ?? j.statusCode ?? ''} ${String(j.message ?? j.error ?? '').slice(0, 80)}`.trim()
  }
  return ''
}
const isErrorBody = (j) => !!j && !Array.isArray(j) && typeof j === 'object' && ('code' in j || 'message' in j || 'error' in j)
const rowCount = (r) => (Array.isArray(r.json) ? r.json.length : r.json && typeof r.json === 'object' && !isErrorBody(r.json) ? 1 : 0)

// ---------------------------------------------------------------------------------------------------- reporting
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
/**
 * An explicit PERMISSION denial: SQLSTATE 42501 (insufficient privilege) from PostgREST, or a 401/403 whose message says
 * permission was denied. A bare 401 is NOT treated as a denial: it is also what an invalid API key produces.
 */
const isDenied = (r) =>
  !!r.json && !Array.isArray(r.json) && (r.json.code === '42501' || ((r.status === 401 || r.status === 403) && /permission denied/i.test(String(r.json.message ?? ''))))
/** PostgREST could not find the relation or function (not deployed, not exposed to this role, or wrong arguments). */
const isNotFound = (r) => r.status === 404 || (!!r.json && !Array.isArray(r.json) && ['PGRST202', 'PGRST205'].includes(r.json.code))
/** The API gateway rejected the key itself (not an authorization decision about data). */
const isKeyRejected = (r) =>
  (r.status === 401 || r.status === 403) && !isDenied(r) && (!r.json || /api ?key|apikey|jwt|unauthori[sz]ed|invalid.*key/i.test(`${r.json?.message ?? ''} ${r.json?.error ?? ''} ${r.json?.hint ?? ''}`))

/** Columns a public function may return; anything else is reported (never its value). */
function checkColumns(name, r, allowed, emptyNote) {
  const stray = [...new Set(r.json.flatMap((row) => Object.keys(row ?? {})))].filter((k) => !allowed.includes(k))
  if (stray.length) report('FAIL', name, r, `unexpected columns in the response: ${stray.join(', ')}`)
  else report('PASS', name, r, r.json.length ? 'callable; only the expected columns were returned.' : emptyNote)
}

// ---------------------------------------------------------------------------------------------------- preflight
console.log(`Public API verification (anonymous role, read-only)`)
console.log(`Target: ${new URL(baseUrl).protocol}//${new URL(baseUrl).hostname.replace(/^(.{4}).*(\..*)$/, '$1…$2')}  (URL from ${cfg.urlSource}; key from ${cfg.keySource})`)
if (cfg.urlSource.split(' ')[0] !== cfg.keySource.split(' ')[0]) console.log('Note: the URL and the key come from different sources; make sure they belong to the same project.')
if (OPT_ORDER_NO) console.log('An operator-supplied order number will be used for one tracking check (its value is not printed).')

// The first request also proves the URL and key form a usable public API configuration.
const preflight = await send('POST', '/rest/v1/rpc/list_enabled_services', { body: {} })
if (isNetworkError(preflight)) configError(`the API could not be reached (${preflight.error}). Check the project URL, DNS, TLS and your network.`)
if (isKeyRejected(preflight)) configError(`the API rejected the key (HTTP ${preflight.status}). Check that VITE_SUPABASE_PUBLISHABLE_KEY / SUPABASE_ANON_KEY is this project's publishable or anon key.`)
if (preflight.malformed || (preflight.status === 404 && !preflight.json)) {
  configError(`the URL did not answer like a Supabase Data API (HTTP ${preflight.status}, ${errorOf(preflight) || 'no JSON body'}). Check the project URL.`)
}
if (preflight.status >= 300 && preflight.status < 400) configError(`the URL redirected (HTTP ${preflight.status}). Use the project's own https URL.`)
console.log('Configuration usable: the Data API answered with this key.\n')

// ---------------------------------------------------------------------------------------------------- checks
console.log('1) Direct reads of private tables (GET, select=id, limit=1)')
for (const table of READ_TABLES) {
  const r = await send('GET', `/rest/v1/${table}?select=id&limit=1`)
  const name = `GET ${table}`
  if (isNetworkError(r)) report('UNEXPECTED', name, r, 'network error: nothing was learned.')
  else if (is2xx(r) && rowCount(r) > 0) report('FAIL', name, r, 'ROWS WERE RETURNED TO AN ANONYMOUS CALLER.')
  else if (isDenied(r)) report('PASS', name, r, 'explicitly denied (insufficient privilege).')
  else if (is2xx(r) && Array.isArray(r.json)) {
    report('INCONCLUSIVE', name, r, 'success with no rows. An empty table returns no rows even when SELECT is allowed, so this proves nothing. Use the has_table_privilege query in docs/supabase/testing.md.')
  } else if (isNotFound(r)) report('UNEXPECTED', name, r, 'table not found: not deployed or not exposed. This is not evidence of a permission denial.')
  else report('UNEXPECTED', name, r, 'neither a permission denial nor an empty success.')
}

console.log('\n2) Public RPCs must be callable and return only their public columns (POST)')
{
  const publicCalls = [
    ['list_enabled_services', {}, ['id', 'slug', 'title', 'tagline', 'category', 'description', 'image_url', 'icon', 'display_order'], preflight],
    ['list_active_schools', {}, ['id', 'name']],
    ['list_published_advertisements', {}, ['id', 'title', 'description', 'offer', 'image_url', 'icon', 'whatsapp_message', 'featured', 'starts_at', 'ends_at']],
    ['list_approved_feedback', { p_limit: 1 }, ['id', 'name', 'organization', 'rating', 'message', 'created_at']],
  ]
  for (const [fn, body, allowed, already] of publicCalls) {
    const r = already ?? (await send('POST', `/rest/v1/rpc/${fn}`, { body }))
    const name = `POST ${fn}`
    if (isNetworkError(r)) report('UNEXPECTED', name, r, 'network error.')
    else if (is2xx(r) && Array.isArray(r.json)) checkColumns(name, r, allowed, 'callable. The list is empty, so the returned column names could not be checked.')
    else if (isNotFound(r)) report('INCONCLUSIVE', name, r, 'function not found: the migrations may not be applied yet.')
    else report('UNEXPECTED', name, r, 'not callable, for a reason other than "not found".')
  }

  // A fabricated slug that cannot exist: exactly one row, status not_found, nothing else revealed.
  const slug = `verify-${randomBytes(6).toString('hex')}`
  const r = await send('POST', '/rest/v1/rpc/resolve_school', { body: { p_slug: slug } })
  const name = 'POST resolve_school (fabricated slug)'
  if (isNetworkError(r)) report('UNEXPECTED', name, r, 'network error.')
  else if (is2xx(r) && Array.isArray(r.json)) {
    const row = r.json[0] ?? {}
    const keysOk = Object.keys(row).every((k) => ['status', 'school_id', 'name', 'slug'].includes(k))
    if (!keysOk) report('FAIL', name, r, 'unexpected columns in the response.')
    else if (r.json.length === 1 && row.status === 'not_found' && row.school_id === null && row.name === null && row.slug === null) report('PASS', name, r, 'one row, status not_found, no school details.')
    else report('FAIL', name, r, 'a fabricated slug did not resolve to a bare "not_found".')
  } else if (isNotFound(r)) report('INCONCLUSIVE', name, r, 'function not found: the migrations may not be applied yet.')
  else report('UNEXPECTED', name, r, 'not callable, for a reason other than "not found".')
}

console.log('\n3) Administrator RPCs must not succeed for an anonymous caller (POST; dummy arguments that match nothing)')
const adminCalls = [
  ['admin_create_order', { p_school_id: null, p_customer_name: 'verification', p_service: 'verification', p_quantity: 1, p_order_date: '2000-01-01', p_expected_delivery: '2000-01-02', p_internal_notes: null }],
  ['admin_review_student', { p_student_id: NIL_UUID, p_decision: 'approved' }],
  ['admin_rotate_tracking_code', { p_order_id: NIL_UUID }],
  ['admin_set_order_status', { p_order_id: NIL_UUID, p_status: 'Printing' }],
  ['admin_summary', {}],
  ['admin_review_file', { p_file_id: NIL_UUID, p_status: 'approved', p_notes: null }],
]
for (const [fn, body] of adminCalls) {
  const r = await send('POST', `/rest/v1/rpc/${fn}`, { body })
  const name = `POST ${fn}`
  if (isNetworkError(r)) report('UNEXPECTED', name, r, 'network error.')
  else if (is2xx(r)) report('FAIL', name, r, 'THE ANONYMOUS CALL SUCCEEDED.')
  else if (isDenied(r)) report('PASS', name, r, 'explicitly denied (insufficient privilege).')
  else if (isNotFound(r)) {
    const note = fn === 'admin_summary' ? ' admin_summary is added by migration 20261012090001; "not found" is expected until it is applied.'
      : fn === 'admin_review_file' ? ' admin_review_file is added by migration 20261013090001; "not found" is expected until it is applied.' : ''
    report('INCONCLUSIVE', name, r, `function not found for this caller. Consistent with a missing EXECUTE grant, but equally with the migration not being applied or the arguments not matching, so it does not prove denial.${note} Use the has_function_privilege query in docs/supabase/testing.md.`)
  } else report('UNEXPECTED', name, r, 'rejected, but not as a clear permission denial.')
}

console.log('\n4) track_order must need BOTH the order number and the secret code (POST + JSON body; fabricated values only)')
const randomCode = () => { const a = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; const b = randomBytes(25); return Array.from(b, (x, i) => a[x & 31] + (i % 5 === 4 && i < 24 ? '-' : '')).join('') }
let trackCallable = false
const trackCases = [
  ['unknown order number + random well-formed code', { p_order_no: 'JOB-0000-0000', p_tracking_code: randomCode() }],
  ['malformed code', { p_order_no: 'JOB-0000-0000', p_tracking_code: 'not-a-code' }],
  ['empty values', { p_order_no: '', p_tracking_code: '' }],
]
if (OPT_ORDER_NO) trackCases.push(['operator-supplied existing order number + random code', { p_order_no: OPT_ORDER_NO, p_tracking_code: randomCode() }])
for (const [label, body] of trackCases) {
  const r = await send('POST', '/rest/v1/rpc/track_order', { body })
  const name = `POST track_order (${label})`
  if (isNetworkError(r)) report('UNEXPECTED', name, r, 'network error.')
  else if (is2xx(r) && rowCount(r) > 0) report('FAIL', name, r, 'ORDER DATA WAS RETURNED FOR A FABRICATED CODE.')
  else if (is2xx(r) && Array.isArray(r.json)) {
    trackCallable = true
    const note = label.startsWith('operator')
      ? 'no order data for a wrong code. This demonstrates the code is enforced, PROVIDED the order number you supplied exists.'
      : 'no order data revealed.'
    report('PASS', name, r, note)
  } else if (isNotFound(r)) report('INCONCLUSIVE', name, r, 'function not found: the migrations may not be applied yet.')
  else report('UNEXPECTED', name, r, 'neither an empty result nor "not found".')
}
{
  // The order number alone must not be enough: there must be no variant of the function that accepts it without a code.
  const r = await send('POST', '/rest/v1/rpc/track_order', { body: { p_order_no: 'JOB-0000-0000' } })
  const name = 'POST track_order (order number only, no code parameter)'
  if (isNetworkError(r)) report('UNEXPECTED', name, r, 'network error.')
  else if (is2xx(r) && rowCount(r) > 0) report('FAIL', name, r, 'ORDER DATA WAS RETURNED WITHOUT A CODE.')
  else if (is2xx(r)) report('FAIL', name, r, 'the function accepted a call without a tracking code (a variant without the code parameter exists).')
  else if (isNotFound(r) && trackCallable) report('PASS', name, r, 'no function accepts the order number alone, while the two-parameter function exists.')
  else if (isNotFound(r)) report('INCONCLUSIVE', name, r, 'not found, but the two-parameter function was not shown to exist either.')
  else report('UNEXPECTED', name, r, 'neither "not found" nor a success.')
}
if (!OPT_ORDER_NO) {
  report('INCONCLUSIVE', 'track_order secret enforcement for a REAL order', null,
    'not tested: an anonymous caller cannot list orders, and no existing order number was supplied. The fabricated cases above only show that '
      + 'nothing leaks for unknown orders. Re-run with --order-no=<an existing order number> (not secret) to show a wrong code is refused for a real '
      + 'order. The correct-code path is covered by supabase/tests/database/04_order_tracking.test.sql, not by this script.')
}

console.log('\n5) Private storage buckets must not be listable anonymously (POST /storage/v1/object/list; read-only)')
for (const bucket of STORAGE_LIST_ALLOW) {
  const r = await send('POST', `/storage/v1/object/list/${bucket}`, { body: { prefix: '', limit: 1, offset: 0 } })
  const name = `LIST ${bucket}`
  const text = `${r.json?.error ?? ''} ${r.json?.message ?? ''}`
  if (isNetworkError(r)) report('UNEXPECTED', name, r, 'network error.')
  else if (is2xx(r) && rowCount(r) > 0) report('FAIL', name, r, 'OBJECTS WERE LISTED FOR AN ANONYMOUS CALLER.')
  else if (is2xx(r) && Array.isArray(r.json)) report('INCONCLUSIVE', name, r, 'an empty list. An empty bucket also lists as empty, so this does not prove the bucket is hidden.')
  else if (isDenied(r) || /unauthori[sz]ed|permission|not allowed/i.test(text)) report('PASS', name, r, 'listing was refused.')
  else if (/not found/i.test(text)) report('INCONCLUSIVE', name, r, '"bucket not found" for this caller: consistent with a private bucket, but also with the bucket not existing.')
  else report('UNEXPECTED', name, r, 'neither a refusal nor an empty list.')
}

console.log('\n6) PRELIMINARY: is the private schema reachable through the Data API? (POST is_admin with Content-Profile: private)')
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
  console.log('\n7) Optional: a GET to track_order must be refused (no parameters, so no credentials in the URL)')
  const r = await send('GET', '/rest/v1/rpc/track_order')
  const name = 'GET track_order (no parameters)'
  if (isNetworkError(r)) report('UNEXPECTED', name, r, 'network error.')
  else if (is2xx(r)) report('FAIL', name, r, 'GET IS ACCEPTED, so the function is not VOLATILE and a code could travel in a URL.')
  else if (r.status === 405) report('PASS', name, r, 'GET refused as "method not allowed", the expected behaviour for a volatile function.')
  else report('INCONCLUSIVE', name, r, 'GET did not succeed, but not with a clear "method not allowed", so this does not prove the function is volatile.')
}

const count = (v) => results.filter((x) => x === v).length
console.log(`\n${results.length} checks: ${count('PASS')} PASS, ${count('FAIL')} FAIL, ${count('INCONCLUSIVE')} INCONCLUSIVE, ${count('UNEXPECTED')} UNEXPECTED.`)
console.log('No data was written; no key, URL or row content was printed. INCONCLUSIVE is not a pass: follow the notes above.')
// Exit codes: 0 = everything passed; 1 = at least one FAIL; 3 = no FAIL but something INCONCLUSIVE/UNEXPECTED; 2 = configuration error.
process.exit(count('FAIL') ? 1 : count('INCONCLUSIVE') + count('UNEXPECTED') ? 3 : 0)
