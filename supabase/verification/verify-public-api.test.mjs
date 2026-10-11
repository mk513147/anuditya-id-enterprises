// Tests for the public API verification script. Everything runs locally: config parsing is pure, and the script itself is
// run against a fake PostgREST/Storage server on 127.0.0.1. No hosted project is contacted.
import { spawn } from 'node:child_process'
import fs from 'node:fs'
import http from 'node:http'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { REPO_ROOT, looksPrivileged, readEnvFile, resolveConfig, validateConfig } from './lib/config.mjs'

const SCRIPT = path.join(REPO_ROOT, 'supabase/verification/verify-public-api.mjs')
const KEY = 'sb_publishable_TESTKEY_abcdefghijklmnop'
const jwt = (role) => `eyJhbGciOiJIUzI1NiJ9.${Buffer.from(JSON.stringify({ role })).toString('base64url')}.c2lnbmF0dXJlLXNpZ25hdHVyZQ`

describe('configuration resolution', () => {
  it('uses the app variable names from .env.local', () => {
    const c = resolveConfig({}, { VITE_SUPABASE_URL: 'https://a.supabase.co', VITE_SUPABASE_PUBLISHABLE_KEY: KEY })
    expect(c).toMatchObject({ url: 'https://a.supabase.co', key: KEY, urlSource: '.env.local VITE_SUPABASE_URL', keySource: '.env.local VITE_SUPABASE_PUBLISHABLE_KEY', missing: [] })
  })

  it('never lets the file override explicitly supplied process values', () => {
    const c = resolveConfig({ SUPABASE_URL: 'https://p.supabase.co', SUPABASE_ANON_KEY: 'sb_publishable_P' }, { VITE_SUPABASE_URL: 'https://f.supabase.co', VITE_SUPABASE_PUBLISHABLE_KEY: KEY })
    expect(c).toMatchObject({ url: 'https://p.supabase.co', key: 'sb_publishable_P', urlSource: 'process environment SUPABASE_URL' })
  })

  it('falls back to the standard names in .env.local, and treats blank values as missing', () => {
    expect(resolveConfig({ SUPABASE_URL: '  ' }, { SUPABASE_URL: 'https://s.supabase.co', SUPABASE_ANON_KEY: KEY, VITE_SUPABASE_URL: '' })).toMatchObject({
      url: 'https://s.supabase.co', urlSource: '.env.local SUPABASE_URL', keySource: '.env.local SUPABASE_ANON_KEY',
    })
  })

  it('reports missing settings by NAME only', () => {
    const c = resolveConfig({}, { VITE_SUPABASE_URL: 'https://a.supabase.co' })
    expect(c.missing).toHaveLength(1)
    expect(c.missing[0]).toContain('SUPABASE_ANON_KEY')
    expect(c.missing[0]).toContain('VITE_SUPABASE_PUBLISHABLE_KEY')
    expect(c.missing.join(' ')).not.toContain('https://a.supabase.co')
  })

  it('parses comments, whitespace and quotes, and handles a missing file', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'verify-env-'))
    const file = path.join(dir, '.env.local')
    fs.writeFileSync(file, '# comment\n\n  VITE_SUPABASE_URL = "https://q.supabase.co"  \nVITE_SUPABASE_PUBLISHABLE_KEY=\'sb_publishable_Q\'\nEMPTY=\n')
    expect(readEnvFile(file).values).toMatchObject({ VITE_SUPABASE_URL: 'https://q.supabase.co', VITE_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_Q', EMPTY: '' })
    expect(readEnvFile(path.join(dir, 'nope'))).toEqual({ exists: false, values: {}, error: null })
    fs.rmSync(dir, { recursive: true })
  })

  it('resolves the repository root from the module location', () => {
    expect(fs.existsSync(path.join(REPO_ROOT, 'package.json'))).toBe(true)
    expect(fs.existsSync(path.join(REPO_ROOT, 'supabase/migrations'))).toBe(true)
  })
})

describe('configuration validation', () => {
  it.each([
    ['https://a.supabase.co/rest/v1/', /no path/],
    ['https://a.supabase.co?x=1', /query string/],
    ['https://a.supabase.co/#frag', /fragment/],
    ['http://a.supabase.co', /https/],
    ['ftp://a.supabase.co', /https/],
    ['not a url', /not a valid URL/],
    ['https://user:pw@a.supabase.co', /credentials/],
  ])('rejects %s', (url, re) => {
    const r = validateConfig(url, KEY)
    expect(r.ok).toBe(false)
    expect(r.problems.join(' ')).toMatch(re)
    expect(r.problems.join(' ')).not.toContain(KEY)
  })

  it('accepts a bare https origin (a trailing slash is fine)', () => {
    expect(validateConfig('https://a.supabase.co/', KEY)).toEqual({ ok: true, origin: 'https://a.supabase.co', isLocal: false })
  })

  it('refuses secret and service-role keys without echoing them', () => {
    for (const k of ['sb_secret_abcdef', jwt('service_role'), jwt('authenticated')]) {
      expect(looksPrivileged(k)).toBe(true)
      const r = validateConfig('https://a.supabase.co', k)
      expect(r.ok).toBe(false)
      expect(r.problems.join(' ')).not.toContain(k)
    }
    expect(looksPrivileged(jwt('anon'))).toBe(false)
  })

  it('allows plain http only for localhost, only when asked', () => {
    expect(validateConfig('http://127.0.0.1:54321', KEY).ok).toBe(false)
    expect(validateConfig('http://127.0.0.1:54321', KEY, { allowHttpLocalhost: true }).ok).toBe(true)
  })
})

// ------------------------------------------------------------------ the script against a fake API
const json = (res, status, body) => { res.writeHead(status, { 'content-type': 'application/json' }); res.end(JSON.stringify(body)) }
const DENIED = (what) => ({ code: '42501', message: `permission denied for ${what}` })

/** A fake that behaves like a correctly secured project (or a broken one, via `mode`). */
function fakeApi(mode = 'secure') {
  const seen = []
  const server = http.createServer((req, res) => {
    let raw = ''
    req.on('data', (c) => (raw += c))
    req.on('end', () => {
      seen.push({ method: req.method, url: req.url, headers: req.headers, body: raw })
      if (req.headers.apikey !== KEY) return json(res, 401, { message: 'Invalid API key' })
      if (mode === 'html') { res.writeHead(404, { 'content-type': 'text/html' }); return res.end('<html>nope</html>') }
      const u = new URL(req.url, 'http://x')
      const body = raw ? JSON.parse(raw) : {}
      if (u.pathname.startsWith('/storage/v1/object/list/')) return json(res, 400, { statusCode: '404', error: 'Bucket not found', message: 'Bucket not found' })
      if (u.pathname.startsWith('/rest/v1/rpc/')) {
        const fn = u.pathname.slice('/rest/v1/rpc/'.length)
        if (req.headers['content-profile'] === 'private') return json(res, 406, { code: 'PGRST106', message: 'Invalid schema: private' })
        if (fn.startsWith('admin_')) return mode === 'leaky-admin' ? json(res, 200, [{ order_id: 'x' }]) : json(res, 401, DENIED(`function ${fn}`))
        if (fn === 'track_order') {
          if (req.method === 'GET') return json(res, 405, { message: 'method not allowed' })
          if (!('p_tracking_code' in body)) return json(res, 404, { code: 'PGRST202', message: 'Could not find the function public.track_order(p_order_no)' })
          return json(res, 200, [])
        }
        if (fn === 'resolve_school') return json(res, 200, [{ status: 'not_found', school_id: null, name: null, slug: null }])
        if (fn === 'list_active_schools') return json(res, 200, mode === 'extra-columns' ? [{ id: 'a', name: 'b', phone: '9000000000' }] : [{ id: 'a', name: 'b' }])
        return json(res, 200, [])
      }
      if (u.pathname.startsWith('/rest/v1/')) return mode === 'leaky-table' ? json(res, 200, [{ id: 'row' }]) : json(res, 401, DENIED(`table ${u.pathname.slice(9)}`))
      json(res, 404, { message: 'not found' })
    })
  })
  return new Promise((resolve) => server.listen(0, '127.0.0.1', () => resolve({ server, seen, url: `http://127.0.0.1:${server.address().port}` })))
}

function runScript(env, args = []) {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, [SCRIPT, '--allow-http-localhost', ...args], { env: { PATH: process.env.PATH, SYSTEMROOT: process.env.SYSTEMROOT, ...env } })
    let out = ''
    child.stdout.on('data', (d) => (out += d))
    child.stderr.on('data', (d) => (out += d))
    child.on('close', (code) => resolve({ code, out }))
  })
}

let current
afterEach(() => current?.server.close())

describe('the script against a fake API', { timeout: 30_000 }, () => {
  it('a correctly secured API: no FAIL, every table and admin function explicitly denied, nothing secret printed', async () => {
    current = await fakeApi('secure')
    const { code, out } = await runScript({ SUPABASE_URL: current.url, SUPABASE_ANON_KEY: KEY }, ['--check-get-refused', '--order-no=JOB-2026-0001'])
    expect(out).toMatch(/0 FAIL/)
    expect(out).toMatch(/\[PASS\] GET students/)
    expect(out).toMatch(/\[PASS\] POST admin_summary/)
    expect(out).toMatch(/\[PASS\] POST resolve_school/)
    expect(out).toMatch(/\[PASS\] POST track_order \(order number only, no code parameter\)/)
    expect(out).toMatch(/\[PASS\] POST track_order \(operator-supplied existing order number/)
    expect(out).toMatch(/\[INCONCLUSIVE\] LIST student-photos/)
    expect(out).toMatch(/\[INCONCLUSIVE\] POST private\.is_admin/)
    expect(code).toBe(3) // inconclusive items remain: never reported as a full pass
    expect(out).not.toContain(KEY)
    expect(out).not.toContain(current.url)
    expect(out).not.toContain('JOB-2026-0001')
  })

  it('only reads: GETs and POSTs to the allow-list, no write function, codes only in POST bodies', async () => {
    current = await fakeApi('secure')
    await runScript({ SUPABASE_URL: current.url, SUPABASE_ANON_KEY: KEY }, ['--check-get-refused'])
    for (const r of current.seen) {
      expect(['GET', 'POST']).toContain(r.method)
      expect(r.url).not.toMatch(/submit_|p_tracking_code|insert|update|delete/i)
      expect(r.headers.authorization).toBeUndefined() // a publishable key is sent as apikey only
    }
    expect(current.seen.some((r) => r.url === '/rest/v1/rpc/track_order' && r.method === 'GET')).toBe(true) // the optional GET probe has no parameters
  })

  it('reports FAIL (exit 1) when an anonymous caller can read a table or run an admin function', async () => {
    current = await fakeApi('leaky-table')
    let r = await runScript({ SUPABASE_URL: current.url, SUPABASE_ANON_KEY: KEY })
    expect(r.code).toBe(1)
    expect(r.out).toMatch(/\[FAIL\] GET students/)
    current.server.close()
    current = await fakeApi('leaky-admin')
    r = await runScript({ SUPABASE_URL: current.url, SUPABASE_ANON_KEY: KEY })
    expect(r.code).toBe(1)
    expect(r.out).toMatch(/\[FAIL\] POST admin_create_order/)
  })

  it('reports FAIL when a public function returns more than its public columns', async () => {
    current = await fakeApi('extra-columns')
    const r = await runScript({ SUPABASE_URL: current.url, SUPABASE_ANON_KEY: KEY })
    expect(r.out).toMatch(/\[FAIL\] POST list_active_schools[\s\S]*unexpected columns in the response: phone/)
    expect(r.out).not.toContain('9000000000')
  })

  it('a rejected key is a CONFIGURATION ERROR (exit 2), not a run of "denied" passes', async () => {
    current = await fakeApi('secure')
    const r = await runScript({ SUPABASE_URL: current.url, SUPABASE_ANON_KEY: 'sb_publishable_WRONG' })
    expect(r.code).toBe(2)
    expect(r.out).toMatch(/CONFIGURATION ERROR[\s\S]*rejected the key/)
    expect(r.out).not.toMatch(/\[PASS\]/)
    expect(r.out).not.toContain('sb_publishable_WRONG')
  })

  it('a URL that is not a Supabase API, or unreachable, is a CONFIGURATION ERROR', async () => {
    current = await fakeApi('html')
    let r = await runScript({ SUPABASE_URL: current.url, SUPABASE_ANON_KEY: KEY })
    expect(r.code).toBe(2)
    expect(r.out).toMatch(/did not answer like a Supabase Data API/)
    r = await runScript({ SUPABASE_URL: 'http://127.0.0.1:1', SUPABASE_ANON_KEY: KEY })
    expect(r.code).toBe(2)
    expect(r.out).toMatch(/could not be reached/)
  })

  it('invalid settings stop before any request (path in URL, secret key)', async () => {
    current = await fakeApi('secure')
    let r = await runScript({ SUPABASE_URL: `${current.url}/rest/v1`, SUPABASE_ANON_KEY: KEY })
    expect(r.code).toBe(2)
    expect(r.out).toMatch(/no path/)
    r = await runScript({ SUPABASE_URL: current.url, SUPABASE_ANON_KEY: 'sb_secret_zzzzzzzz' })
    expect(r.code).toBe(2)
    expect(r.out).toMatch(/secret or service-role/)
    expect(r.out).not.toContain('sb_secret_zzzzzzzz')
    expect(current.seen).toHaveLength(0)
  })
})
