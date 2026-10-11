/// <reference types="node" />
import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

// Static guards over the source tree. They cannot prove the system is secure; they stop specific mistakes from being
// introduced by accident (public sign-up, role writes from the browser, privileged keys in the bundle).
const ROOT = path.resolve(import.meta.dirname, '../../..')
const SRC = path.join(ROOT, 'src')

function listFiles(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? listFiles(path.join(dir, e.name)) : [path.join(dir, e.name)]))
}
const appFiles = listFiles(SRC).filter((f) => /\.(ts|tsx)$/.test(f) && !/\.test\.(ts|tsx)$/.test(f))
const rel = (f: string) => path.relative(ROOT, f).replace(/\\/g, '/')
const withoutComments = (code: string) => code.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
const matching = (re: RegExp) => appFiles.filter((f) => re.test(fs.readFileSync(f, 'utf8'))).map(rel)

describe('no public sign-up and no role self-assignment', () => {
  it('the app never calls an account-creating Auth API', () => {
    expect(matching(/\.signUp\s*\(|signInWithOtp\s*\(|signInAnonymously\s*\(|signInWithOAuth\s*\(|\.admin\.(createUser|inviteUserByEmail)/)).toEqual([])
  })

  it('the app never writes to profiles or calls the provisioning function', () => {
    expect(matching(/from\(\s*['"`]profiles['"`]\s*\)\s*\.\s*(insert|update|upsert|delete)/)).toEqual([])
    expect(matching(/provision_administrator/)).toEqual([])
    expect(matching(/rpc\(\s*['"`]admin_/)).toEqual([]) // admin functions are not wired in this phase
  })

  it('the only table the app reads for authentication is profiles, selecting only the role', () => {
    const uses = matching(/\.from\(\s*['"`]profiles['"`]\s*\)/)
    expect(uses).toEqual(['src/features/auth/supabaseBackend.ts'])
    expect(fs.readFileSync(path.join(SRC, 'features/auth/supabaseBackend.ts'), 'utf8')).toMatch(/\.select\('role'\)\s*\.eq\('id'/)
  })

  it('the login screen has no sign-up, registration or reset links', () => {
    const src = withoutComments(fs.readFileSync(path.join(SRC, 'pages/LoginPage.tsx'), 'utf8'))
    // (react-hook-form's register() is allowed; this looks for account-creation or reset wording and links)
    expect(src).not.toMatch(/sign[- ]?up|create (an )?account|forgot|reset ?password|to=["']\/(register|signup)|>\s*register\s*</i)
  })

  it('the router only exposes /login as an authentication route (no register or signup route)', () => {
    const router = fs.readFileSync(path.join(SRC, 'router.tsx'), 'utf8')
    expect(router).not.toMatch(/path:\s*'\/?(register|signup|sign-up|reset|forgot)/i)
    expect(router).toMatch(/<RequireAdmin>\s*<AdminLayout \/>\s*<\/RequireAdmin>/)
  })
})

describe('no privileged credentials in browser code', () => {
  it('no VITE_ variable name suggests a secret or service-role key', () => {
    const names = new Set<string>()
    for (const f of [...appFiles, path.join(SRC, 'vite-env.d.ts'), path.join(ROOT, '.env.example')].filter((x) => fs.existsSync(x))) {
      for (const m of fs.readFileSync(f, 'utf8').matchAll(/VITE_[A-Z0-9_]+/g)) names.add(m[0])
    }
    expect([...names].sort()).toEqual(['VITE_SUPABASE_PUBLISHABLE_KEY', 'VITE_SUPABASE_URL'])
    for (const n of names) expect(n).not.toMatch(/SECRET|SERVICE|PRIVATE|PASSWORD|DB_|DATABASE/)
  })

  it('no source file mentions a service-role or secret key value', () => {
    expect(matching(/service_role|SERVICE_ROLE|sb_secret_[A-Za-z0-9]/).filter((f) => f !== 'src/lib/supabaseConfig.ts')).toEqual([])
  })

  it('only src/lib/supabase.ts creates a Supabase client, and it uses the validated public settings', () => {
    expect(matching(/createClient\s*\(/)).toEqual(['src/lib/supabase.ts'])
    const src = fs.readFileSync(path.join(SRC, 'lib/supabase.ts'), 'utf8')
    expect(src).toContain('validateSupabaseConfig(import.meta.env.VITE_SUPABASE_URL, import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY)')
  })

  it('.env.example exists, holds no values, and real env files are ignored by git', () => {
    const example = fs.readFileSync(path.join(ROOT, '.env.example'), 'utf8')
    for (const line of example.split(/\r?\n/).filter((l) => /^[A-Z_]+=/.test(l))) expect(line.split('=')[1].trim()).toBe('')
    expect(fs.readFileSync(path.join(ROOT, '.gitignore'), 'utf8')).toMatch(/^\*\.local$/m)
    expect(fs.readFileSync(path.join(ROOT, '.gitignore'), 'utf8')).toMatch(/^\.env$|^\.env\*|\.env\.local/m)
  })

  it('the session is not logged', () => {
    expect(matching(/console\.(log|info|debug|warn|error)\([^)]*(session|password|token|credential)/i).filter((f) => f.startsWith('src/features/auth') || f === 'src/lib/supabase.ts')).toEqual([])
  })
})

describe('existing public workflows still run on the mock repositories', () => {
  it('src/services/index.ts still wires the mock repositories and nothing from Supabase', () => {
    const wiring = fs.readFileSync(path.join(SRC, 'services/index.ts'), 'utf8')
    expect(wiring).toMatch(/from '\.\/mock/)
    expect(wiring.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')).not.toMatch(/supabase/i) // comments aside
  })

  it('the public order lookup and student submission code do not depend on the auth module', () => {
    const publicFiles = appFiles.map(rel).filter((f) => /^src\/(features\/(orders|students)\/(components|hooks)|pages\/(JobStatusPage|StudentFormPage|SchoolSubmissionPage))/.test(f))
    expect(publicFiles.length).toBeGreaterThan(0)
    for (const f of publicFiles) expect(fs.readFileSync(path.join(ROOT, f), 'utf8'), f).not.toMatch(/features\/auth|lib\/supabase/)
  })
})
