/// <reference types="node" />
import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

// Static checks over the manual provisioning scripts. The executable behaviour is tested in the PostgreSQL emulator
// (supabase/verification/emulator/provisioning.test.mjs); these keep the scripts, the migrations and the docs consistent.
const ROOT = path.resolve(import.meta.dirname, '../../..')
const read = (rel: string) => fs.readFileSync(path.join(ROOT, rel), 'utf8')
const SQL01 = read('supabase/provisioning/01_preflight_read_only.sql')
const SQL02 = read('supabase/provisioning/02_provision_administrator.sql')
const SQL03 = read('supabase/provisioning/03_verify_administrator.sql')
const DOC = read('docs/supabase/admin-provisioning.md')

/** SQL with comments and string literals removed, so only executable text remains. */
const executable = (sql: string) => sql.replace(/'(?:[^']|'')*'|--[^\n]*/g, (m) => (m.startsWith('--') ? '' : "''"))
const FORBIDDEN = /\b(insert|update|delete|create|alter|drop|grant|revoke|truncate|perform|set_config)\b/i

const migrationVersions = fs.readdirSync(path.join(ROOT, 'supabase/migrations')).filter((f) => f.endsWith('.sql')).sort().map((f) => f.split('_')[0])

describe('provisioning scripts', () => {
  it('01 lists exactly the migration versions that exist in supabase/migrations, in order', () => {
    const listed = [...SQL01.matchAll(/'(\d{14})'/g)].map((m) => m[1])
    expect(migrationVersions).toHaveLength(14)
    expect(listed).toEqual(migrationVersions)
  })

  it('01 and 03 are a single read-only SELECT (no data or schema changes)', () => {
    for (const sql of [SQL01, SQL03]) {
      expect(executable(sql)).not.toMatch(FORBIDDEN)
      expect(executable(sql).match(/;/g)).toHaveLength(1) // exactly one statement
      expect(executable(sql).trim().startsWith('with')).toBe(true)
    }
  })

  it('every check row can only be PASS, FAIL or INCONCLUSIVE, and an OVERALL row summarises them', () => {
    for (const sql of [SQL01, SQL03]) {
      const results = new Set([...sql.matchAll(/'(PASS|FAIL|INCONCLUSIVE)'/g)].map((m) => m[1]))
      expect([...results].sort()).toEqual(['FAIL', 'INCONCLUSIVE', 'PASS'])
      expect(sql).toMatch(/bool_or\(result = 'FAIL'\)/)
    }
  })

  it('02 defaults to a preview that changes nothing, and only applies when v_apply is set to true', () => {
    expect(SQL02).toMatch(/v_apply\s+boolean\s+:= false;/)
    expect(SQL02).toContain('PREVIEW ONLY - NOTHING WAS CHANGED')
    expect(SQL02).toMatch(/perform private\.provision_administrator\(v_user_id\)/)
  })

  it('02 requires both an identifying UID and the intended email, and demands exactly one Auth user', () => {
    expect(SQL02).toContain("'<ADMIN_AUTH_USER_UID>'")
    expect(SQL02).toContain("'<INTENDED_ADMIN_EMAIL>'")
    expect(SQL02).toMatch(/v_total_users <> 1/)
    expect(SQL02).toMatch(/EMAIL MISMATCH/)
  })

  it('02 uses only the existing owner-only function: no new RPC, no grants, no policy changes', () => {
    expect(executable(SQL02)).not.toMatch(/\b(create|alter|drop|grant|revoke)\b/i)
    expect(executable(SQL02).match(/private\.provision_administrator/g)).toHaveLength(1) // the single call...
    expect(SQL02).toContain("to_regprocedure('private.provision_administrator(uuid)')") // ...after checking it exists
  })

  it('no script or document contains a real UID, email, password, key or connection string', () => {
    for (const text of [SQL01, SQL02, SQL03]) {
      expect(text).not.toMatch(/eyJ[A-Za-z0-9_-]{20,}|sb_secret_|sb_publishable_|postgres(ql)?:\/\//)
      expect(text).not.toMatch(/\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/i) // no concrete UID
      expect(text).not.toMatch(/[A-Za-z0-9._%+-]+@(?!example\.)[A-Za-z0-9.-]+\.[a-z]{2,}/i) // no real email
    }
  })

  it('the migrations still define everything the scripts check', () => {
    const profiles = read('supabase/migrations/20261011150002_profiles_admin.sql')
    expect(profiles).toContain('create unique index profiles_single_admin on public.profiles (role) where role = \'admin\'')
    expect(profiles).toContain('create trigger profiles_guard_write before insert or update on public.profiles')
    expect(profiles).toContain('create function private.provision_administrator(p_user_id uuid)')
    expect(profiles).toMatch(/profiles enable row level security|public\.profiles enable row level security/)
    expect(read('supabase/migrations/20261011150008_rls_policies_and_grants.sql')).toContain('create policy profiles_select_own on public.profiles for select to authenticated')
    expect(read('supabase/migrations/20261011160001_restrict_private_schema_usage.sql')).toContain('revoke usage on schema private from anon, authenticated')
  })
})

describe('admin provisioning document', () => {
  it('documents every required point', () => {
    for (const needle of [
      '20261011150001', '20261011160001', // the expected migration versions
      'schema_migrations', // the verification query
      'PREVIEW ONLY', // the two-step provisioning
      'soft delete', // do not assume a hard delete
      'Forgotten password', // routine recovery is distinct from replacement
      'Replace', // replacing a compromised or unrecoverable account
      'NOT TESTED', // untested Dashboard behaviour is labelled
    ]) expect(DOC, needle).toContain(needle)
  })

  it('no longer claims the anonymous API script proves Dashboard user creation works', () => {
    expect(DOC).not.toMatch(/Step 1 below confirms it/)
    expect(DOC).toMatch(/tested separately|separate test/i)
  })

  it('does not recommend manual profile deletion as the default recovery', () => {
    expect(DOC).toMatch(/not the default/i)
  })

  it('states that routine password reset is a separate future feature the app does not have', () => {
    expect(DOC).toMatch(/future feature/i)
  })
})
