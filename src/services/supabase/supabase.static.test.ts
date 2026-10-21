/// <reference types="node" />
import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

// Static guards that keep the browser code and the database contract in step. They do not replace the database tests
// (supabase/tests/database), which prove the permissions themselves.
const ROOT = path.resolve(import.meta.dirname, '../../..')
const SRC = path.join(ROOT, 'src')
const MIGRATIONS = path.join(ROOT, 'supabase/migrations')

const listFiles = (dir: string): string[] =>
  fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? listFiles(path.join(dir, e.name)) : [path.join(dir, e.name)]))
const rel = (f: string) => path.relative(ROOT, f).replace(/\\/g, '/')
const appFiles = listFiles(SRC)
  .filter((f) => /\.(ts|tsx)$/.test(f) && !/\.test\.(ts|tsx)$/.test(f))
  .filter((f) => !rel(f).endsWith('services/supabase/fakeClient.ts'))
const code = (f: string) => fs.readFileSync(f, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')

/** public.<name>(params) → parameter names, from every migration (later definitions replace earlier ones). */
function migrationFunctions(): Map<string, { params: string[]; required: string[] }> {
  const fns = new Map<string, { params: string[]; required: string[] }>()
  for (const f of fs.readdirSync(MIGRATIONS).filter((x) => x.endsWith('.sql')).sort()) {
    const sql = fs.readFileSync(path.join(MIGRATIONS, f), 'utf8')
    for (const m of sql.matchAll(/create (?:or replace )?function public\.(\w+)\s*\(([\s\S]*?)\)\s*returns/gi)) {
      const parts = m[2].split(',').map((p) => p.trim()).filter(Boolean)
      fns.set(m[1], {
        params: parts.map((p) => p.split(/\s+/)[0]),
        required: parts.filter((p) => !/\sdefault\s/i.test(p)).map((p) => p.split(/\s+/)[0]),
      })
    }
  }
  return fns
}

describe('the browser calls only real database functions, with their real parameter names', () => {
  const fns = migrationFunctions()
  const calls = appFiles.flatMap((f) =>
    [...code(f).matchAll(/\.rpc\(\s*'(\w+)'\s*(?:,\s*\{([\s\S]*?)\}\s*)?\)/g)].map((m) => ({
      file: rel(f),
      name: m[1],
      keys: m[2] ? [...m[2].matchAll(/(p_\w+)\s*:/g)].map((k) => k[1]) : [],
    })),
  )

  it('finds the calls (the withdrawn submit_file_upload is no longer called)', () => {
    expect(new Set(calls.map((c) => c.name))).toEqual(
      new Set([
        'admin_summary', 'list_active_schools', 'resolve_school', 'submit_student', 'admin_review_student', 'track_order', 'admin_create_order',
        'admin_rotate_tracking_code', 'admin_set_order_status', 'list_enabled_services', 'list_published_advertisements', 'list_approved_feedback',
        'submit_feedback', 'submit_school_file', 'admin_review_file', 'admin_register_school_image', 'admin_set_primary_school_image',
      ]),
    )
  })

  it.each(calls.map((c) => [`${c.name} (${c.file})`, c] as const))('%s', (_label, c) => {
    const fn = fns.get(c.name)
    expect(fn, `public.${c.name} is not defined by any migration`).toBeDefined()
    for (const k of c.keys) expect(fn!.params, `${c.name} has no parameter ${k}`).toContain(k)
    for (const r of fn!.required) expect(c.keys, `${c.name} needs ${r}`).toContain(r)
  })
})

describe('database access stays in the data layer and names its columns', () => {
  it('only the Supabase repositories and the auth backend touch tables, functions or storage', () => {
    const touching = appFiles.filter((f) => /\.(from|rpc)\(\s*'|\.storage\b/.test(code(f))).map(rel)
    for (const f of touching) expect(f.startsWith('src/services/supabase/') || f === 'src/features/auth/supabaseBackend.ts', f).toBe(true)
  })

  it('never uses select("*") or an empty select (orders even have a column no client may read)', () => {
    for (const f of appFiles) expect(code(f), rel(f)).not.toMatch(/\.select\(\s*['"`]\s*\*/)
    // (an empty .select() is a DOM method elsewhere, e.g. selecting text in the clipboard helper)
    for (const f of appFiles.filter((x) => rel(x).startsWith('src/services/supabase/'))) expect(code(f), rel(f)).not.toMatch(/\.select\(\s*\)/)
  })

  it('reads only the application tables, and never profiles from the data layer', () => {
    const allowed = new Set(['schools', 'students', 'orders', 'order_status_history', 'uploaded_files', 'uploaded_file_reviews', 'school_images', 'services', 'advertisements', 'feedback'])
    for (const f of appFiles.filter((x) => rel(x).startsWith('src/services/supabase/'))) {
      for (const m of code(f).matchAll(/\.from\(\s*'(\w[\w-]*)'\s*\)/g)) {
        // storage.from('<bucket>') uses the same method name
        if (m[1] === 'student-photos' || m[1] === 'school-uploads' || m[1] === 'school-images') continue
        expect(allowed.has(m[1]), `${rel(f)} reads ${m[1]}`).toBe(true)
      }
    }
  })

  it('never mentions the tracking hash, a service key or the private schema in browser code', () => {
    for (const f of appFiles) expect(code(f), rel(f)).not.toMatch(/tracking_secret_hash|service_role|private\.\w+\(/)
  })

  it('never logs codes, signed links or personal data from the data layer or the order/student/file features', () => {
    const scoped = appFiles.filter((f) => /^src\/(services|features\/(orders|students|uploads))\//.test(rel(f)))
    for (const f of scoped) expect(code(f), rel(f)).not.toMatch(/console\.(log|info|debug|warn|error)\(/)
  })

  it('the tracking code never goes into a URL, a query key or browser storage', () => {
    const files = ['src/pages/JobStatusPage.tsx', 'src/features/orders/components/TrackOrderForm.tsx', 'src/features/orders/hooks.ts', 'src/features/orders/admin/TrackingCodeReveal.tsx', 'src/features/orders/admin/TrackingCodeRotator.tsx', 'src/features/orders/admin/OrderCreateDialog.tsx']
    for (const f of files) {
      const src = code(path.join(ROOT, f))
      expect(src, f).not.toMatch(/localStorage|sessionStorage|indexedDB/)
      expect(src, f).not.toMatch(/setParams\(|setSearchParams\(|[?&](code|trackingCode)=/)
      expect(src, f).not.toMatch(/queryKey:[^\n]*tracking/i)
    }
  })
})
