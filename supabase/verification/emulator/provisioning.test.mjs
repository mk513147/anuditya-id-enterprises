// Executable tests for supabase/provisioning/01, 02 and 03, run in an in-memory PostgreSQL emulator (PGlite).
// NOT Supabase: it uses stand-ins for the auth and storage schemas (see prelude.sql). It proves the SQL logic, not hosted behaviour.
//
//   npm install --no-save @electric-sql/pglite        (not a project dependency)
//   node supabase/verification/emulator/provisioning.test.mjs
//   (or set PGLITE_ROOT to a folder whose node_modules contains @electric-sql/pglite)
import { createRequire } from 'node:module'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const SUPABASE = path.resolve(HERE, '../..')
const req = createRequire(path.join(process.env.PGLITE_ROOT ?? process.cwd(), 'noop.js'))
const { PGlite } = req('@electric-sql/pglite')
const { pgcrypto } = req('@electric-sql/pglite/contrib/pgcrypto')
const { pg_trgm } = req('@electric-sql/pglite/contrib/pg_trgm')

const MIGRATIONS = fs.readdirSync(path.join(SUPABASE, 'migrations')).filter((f) => f.endsWith('.sql')).sort()
const read = (f) => fs.readFileSync(path.join(SUPABASE, 'provisioning', f), 'utf8')
const SQL01 = read('01_preflight_read_only.sql')
const SQL02 = read('02_provision_administrator.sql')
const SQL03 = read('03_verify_administrator.sql')

const db = new PGlite({ extensions: { pgcrypto, pg_trgm } })
await db.exec(fs.readFileSync(path.join(HERE, 'prelude.sql'), 'utf8'))
for (const f of MIGRATIONS) {
  await db.exec(fs.readFileSync(path.join(SUPABASE, 'migrations', f), 'utf8'))
  await db.exec(`insert into supabase_migrations.schema_migrations (version, name) values ('${f.split('_')[0]}', '${f.replace(/^\d+_/, '').replace(/\.sql$/, '')}')`)
}


// SQL with string literals and comments removed (a tiny tokenizer, so a "--" inside a string or a quote inside a comment is handled).
const STRING_OR_COMMENT = new RegExp("'(?:[^']|'')*'|--[^\\n]*", 'g')
const executableSql = (sql) => sql.replace(STRING_OR_COMMENT, (m) => (m.startsWith('--') ? '' : "''"))
const FORBIDDEN = /\b(insert|update|delete|create|alter|drop|grant|revoke|truncate|perform|set_config)\b/i

const results = []
let current = ''
const ok = (name, cond, detail = '') => { results.push(!!cond); console.log(`${cond ? 'PASS' : 'FAIL'}  ${current ? current + ': ' : ''}${name}${!cond && detail ? '  -> ' + detail : ''}`) }

const ADMIN = { id: 'aaaaaaaa-1111-4222-8333-444444444444', email: 'admin@example.invalid' }
const OTHER = { id: 'bbbbbbbb-1111-4222-8333-444444444444', email: 'other@example.invalid' }
const sqlLit = (v) => (v === null ? 'null' : `'${String(v).replace(/'/g, "''")}'`)
async function addUser(u, o = {}) {
  const confirmed = o.confirmed ?? true
  await db.exec(`insert into auth.users (id, email, email_confirmed_at, deleted_at, banned_until, is_anonymous, is_sso_user) values (${sqlLit(u.id)}, ${sqlLit(u.email)}, ${confirmed ? 'now()' : 'null'}, ${o.deleted ? 'now()' : 'null'}, ${o.banned ? "now() + interval '1 day'" : 'null'}, ${!!o.anon}, ${!!o.sso})`)
}
const fill = (sql, user = ADMIN, email = user?.email) => sql.split('<ADMIN_AUTH_USER_UID>').join(user.id).split('<INTENDED_ADMIN_EMAIL>').join(email)
const apply = (sql) => sql.replace(/v_apply\s+boolean\s+:= false;/, 'v_apply          boolean := true;')

/** Runs fn inside a transaction that is always rolled back, so every case starts from the clean migrated database. */
async function scenario(name, fn) {
  current = name
  await db.exec('begin')
  try { await fn() } catch (e) { ok('scenario threw unexpectedly', false, e.message) }
  await db.exec('rollback').catch(() => {})
}
const q = async (sql) => (await db.query(sql)).rows
const row = (rows, n) => rows.find((r) => Number(r['#']) === n)
const overall = (rows) => rows.find((r) => Number(r['#']) === 99).result
async function failsWith(sql, re) {
  await db.exec('savepoint s1')
  try { await db.exec(sql); await db.exec('release savepoint s1'); return { threw: false, message: '' } } catch (e) { await db.exec('rollback to savepoint s1'); return { threw: true, message: e.message, matches: re.test(e.message) } }
}
const count = async (t) => Number((await q(`select count(*)::int as n from ${t}`))[0].n)

// ============================================================================================ 01 preflight
await scenario('01 clean state, no UID supplied', async () => {
  await addUser(ADMIN)
  const rows = await q(SQL01)
  ok('returns 20 rows (19 checks + overall)', rows.length === 20)
  ok('no row FAILs', !rows.some((r) => r.result === 'FAIL'), JSON.stringify(rows.filter((r) => r.result === 'FAIL')))
  ok('user-specific rows are INCONCLUSIVE, not PASS', [12, 13, 14, 15, 16, 17, 18, 19].every((n) => row(rows, n).result === 'INCONCLUSIVE'))
  ok('OVERALL is INCONCLUSIVE', overall(rows) === 'INCONCLUSIVE')
  ok('15 migration versions match', row(rows, 2).result === 'PASS')
})
await scenario('01 everything correct and the user supplied', async () => {
  await addUser(ADMIN)
  const rows = await q(fill(SQL01))
  ok('every row PASSes', rows.every((r) => r.result === 'PASS'), JSON.stringify(rows.filter((r) => r.result !== 'PASS').map((r) => [r['#'], r.result])))
})
await scenario('01 is read-only (no data or catalog change)', async () => {
  await addUser(ADMIN)
  const before = [await count('public.profiles'), await count('auth.users'), await count('supabase_migrations.schema_migrations')]
  await q(fill(SQL01))
  ok('row counts unchanged', JSON.stringify(before) === JSON.stringify([await count('public.profiles'), await count('auth.users'), await count('supabase_migrations.schema_migrations')]))
  ok('no DML or DDL keywords in the executable SQL', !FORBIDDEN.test(executableSql(SQL01)))
})
await scenario('01 zero Auth users', async () => { const r = await q(SQL01); ok('check 10 FAILs', row(r, 10).result === 'FAIL'); ok('OVERALL FAIL', overall(r) === 'FAIL') })
await scenario('01 two Auth users', async () => { await addUser(ADMIN); await addUser(OTHER); const r = await q(fill(SQL01)); ok('check 10 FAILs', row(r, 10).result === 'FAIL'); ok('OVERALL FAIL', overall(r) === 'FAIL') })
await scenario('01 wrong UID', async () => { await addUser(ADMIN); const r = await q(fill(SQL01, { id: OTHER.id }, ADMIN.email)); ok('check 13 (user exists) FAILs', row(r, 13).result === 'FAIL'); ok('OVERALL FAIL', overall(r) === 'FAIL') })
await scenario('01 wrong intended email', async () => { await addUser(ADMIN); const r = await q(fill(SQL01, ADMIN, 'someone.else@example.invalid')); ok('check 14 FAILs', row(r, 14).result === 'FAIL') })
await scenario('01 malformed UID', async () => { await addUser(ADMIN); const r = await q(fill(SQL01, { id: 'not-a-uuid' }, ADMIN.email)); ok('check 12 FAILs and no error was thrown', row(r, 12).result === 'FAIL') })
for (const [label, opts, n] of [['unconfirmed', { confirmed: false }, 15], ['soft-deleted', { deleted: true }, 16], ['banned', { banned: true }, 17], ['anonymous', { anon: true }, 18], ['single-sign-on', { sso: true }, 19]]) {
  await scenario(`01 ${label} user`, async () => { await addUser(ADMIN, opts); const r = await q(fill(SQL01)); ok(`check ${n} FAILs`, row(r, n).result === 'FAIL'); ok('OVERALL FAIL', overall(r) === 'FAIL') })
}
await scenario('01 a missing migration', async () => { await addUser(ADMIN); await db.exec("delete from supabase_migrations.schema_migrations where version = '20261011150008'"); const r = await q(fill(SQL01)); ok('check 2 FAILs and names the missing version', row(r, 2).result === 'FAIL' && /MISSING: 20261011150008/.test(row(r, 2).detail)) })
await scenario('01 an unexpected extra migration', async () => { await addUser(ADMIN); await db.exec("insert into supabase_migrations.schema_migrations (version) values ('20270101000000')"); const r = await q(fill(SQL01)); ok('check 2 FAILs and names the extra version', row(r, 2).result === 'FAIL' && /UNEXPECTED: 20270101000000/.test(row(r, 2).detail)) })
await scenario('01 migration history table absent', async () => { await addUser(ADMIN); await db.exec('drop table supabase_migrations.schema_migrations'); const r = await q(fill(SQL01)); ok('checks 1 and 2 are INCONCLUSIVE, not PASS', row(r, 1).result === 'INCONCLUSIVE' && row(r, 2).result === 'INCONCLUSIVE') })
await scenario('01 missing unique index', async () => { await addUser(ADMIN); await db.exec('drop index public.profiles_single_admin'); const r = await q(fill(SQL01)); ok('check 4 FAILs', row(r, 4).result === 'FAIL'); ok('OVERALL FAIL', overall(r) === 'FAIL') })
await scenario('01 missing guard trigger', async () => { await addUser(ADMIN); await db.exec('drop trigger profiles_guard_write on public.profiles'); const r = await q(fill(SQL01)); ok('check 5 FAILs', row(r, 5).result === 'FAIL') })
await scenario('01 RLS disabled on profiles', async () => { await addUser(ADMIN); await db.exec('alter table public.profiles disable row level security'); const r = await q(fill(SQL01)); ok('check 6 FAILs', row(r, 6).result === 'FAIL') })
await scenario('01 an extra write policy on profiles', async () => { await addUser(ADMIN); await db.exec("create policy sneaky on public.profiles for insert to authenticated with check (true)"); const r = await q(fill(SQL01)); ok('check 7 FAILs', row(r, 7).result === 'FAIL') })
await scenario('01 provisioning function missing', async () => { await addUser(ADMIN); await db.exec('drop function private.provision_administrator(uuid)'); const r = await q(fill(SQL01)); ok('check 3 FAILs', row(r, 3).result === 'FAIL') })
await scenario('01 USAGE on private granted to anon', async () => { await addUser(ADMIN); await db.exec('grant usage on schema private to anon'); const r = await q(fill(SQL01)); ok('check 8 FAILs', row(r, 8).result === 'FAIL') })
await scenario('01 a user token is present in the session', async () => { await addUser(ADMIN); await db.exec(`select set_config('request.jwt.claims', '{"sub":"${OTHER.id}"}', true)`); const r = await q(fill(SQL01)); ok('check 9 FAILs', row(r, 9).result === 'FAIL') })
await scenario('01 an administrator already exists', async () => { await addUser(ADMIN); await db.exec(`select private.provision_administrator('${ADMIN.id}')`); const r = await q(fill(SQL01)); ok('check 11 FAILs', row(r, 11).result === 'FAIL') })
await scenario('01 attribute columns this project does not expose', async () => {
  await addUser(ADMIN)
  await db.exec('alter table auth.users drop column deleted_at, drop column banned_until, drop column is_anonymous, drop column is_sso_user')
  const r = await q(fill(SQL01))
  ok('checks 16 to 19 are INCONCLUSIVE (not assumed PASS)', [16, 17, 18, 19].every((n) => row(r, n).result === 'INCONCLUSIVE'))
  ok('the confirmed-email check still PASSes', row(r, 15).result === 'PASS')
  ok('OVERALL is INCONCLUSIVE with no FAIL', overall(r) === 'INCONCLUSIVE')
})

// ============================================================================================ 02 provisioning
await scenario('02 preview (the default) changes nothing and shows the email', async () => {
  await addUser(ADMIN)
  const r = await failsWith(fill(SQL02), /PREVIEW ONLY - NOTHING WAS CHANGED/)
  ok('stops with the PREVIEW message', r.threw && r.matches, r.message)
  ok('the message shows the target email and UID', r.message.includes(ADMIN.email) && r.message.includes(ADMIN.id))
  ok('no profile was created', (await count('public.profiles')) === 0)
})
await scenario('02 apply provisions exactly the intended user', async () => {
  await addUser(ADMIN)
  await db.exec(apply(fill(SQL02)))
  const profiles = await q('select id::text as id, role::text as role from public.profiles')
  ok('one profile, admin role, matching the Auth user', profiles.length === 1 && profiles[0].id === ADMIN.id && profiles[0].role === 'admin')
})
await scenario('02 apply is idempotent (safe to re-run)', async () => {
  await addUser(ADMIN)
  await db.exec(apply(fill(SQL02)))
  await db.exec(apply(fill(SQL02)))
  ok('still exactly one administrator and no error', (await count('public.profiles')) === 1)
})
await scenario('02 refuses placeholders', async () => {
  await addUser(ADMIN)
  ok('untouched script is refused', (await failsWith(apply(SQL02), /Fill in BOTH/)).matches)
  ok('only the UID filled in is refused', (await failsWith(apply(SQL02.split('<ADMIN_AUTH_USER_UID>').join(ADMIN.id)), /Fill in BOTH/)).matches)
  ok('only the email filled in is refused', (await failsWith(apply(SQL02.split('<INTENDED_ADMIN_EMAIL>').join(ADMIN.email)), /Fill in BOTH/)).matches)
})
await scenario('02 refuses a malformed UID or email', async () => {
  await addUser(ADMIN)
  ok('malformed UID', (await failsWith(apply(fill(SQL02, { id: 'not-a-uuid' }, ADMIN.email)), /not a well-formed UUID/)).matches)
  ok('implausible email', (await failsWith(apply(fill(SQL02, ADMIN, 'nope')), /not a plausible email/)).matches)
})
await scenario('02 refuses a wrong UID', async () => {
  await addUser(ADMIN)
  const r = await failsWith(apply(fill(SQL02, { id: OTHER.id }, ADMIN.email)), /No Auth user has UID/)
  ok('refused with a clear message', r.matches, r.message); ok('nothing created', (await count('public.profiles')) === 0)
})
await scenario('02 refuses the wrong intended email and shows both emails', async () => {
  await addUser(ADMIN)
  const r = await failsWith(apply(fill(SQL02, ADMIN, 'someone.else@example.invalid')), /EMAIL MISMATCH/)
  ok('refused', r.matches, r.message)
  ok('the message names the actual and the intended email', r.message.includes(ADMIN.email) && r.message.includes('someone.else@example.invalid'))
  ok('nothing created', (await count('public.profiles')) === 0)
})
await scenario('02 refuses zero Auth users', async () => { ok('refused', (await failsWith(apply(fill(SQL02)), /Expected exactly 1 Auth user but found 0/)).matches) })
await scenario('02 refuses multiple Auth users', async () => {
  await addUser(ADMIN); await addUser(OTHER)
  ok('refused', (await failsWith(apply(fill(SQL02)), /Expected exactly 1 Auth user but found 2/)).matches); ok('nothing created', (await count('public.profiles')) === 0)
})
for (const [label, opts, re] of [['unconfirmed', { confirmed: false }, /not confirmed/], ['soft-deleted', { deleted: true }, /soft-deleted/], ['banned', { banned: true }, /banned/], ['anonymous', { anon: true }, /anonymous/], ['single-sign-on', { sso: true }, /single-sign-on/]]) {
  await scenario(`02 refuses a ${label} user`, async () => { await addUser(ADMIN, opts); const r = await failsWith(apply(fill(SQL02)), re); ok('refused', r.matches, r.message); ok('nothing created', (await count('public.profiles')) === 0) })
}
await scenario('02 refuses to promote anyone while another administrator exists', async () => {
  await addUser(OTHER)
  await db.exec(`insert into public.profiles (id, role) values ('${OTHER.id}', 'admin')`)
  // exactly one Auth user exists (OTHER, already administrator); asking to promote it again is the idempotent path...
  const same = await failsWith(apply(fill(SQL02, OTHER)), /./)
  ok('promoting the existing administrator again is a harmless no-op', !same.threw)
  // ...and promoting a different account is impossible: the function, the index and the script all refuse.
  const second = await failsWith(`select private.provision_administrator('${ADMIN.id}')`, /./)
  ok('the function refuses a second administrator (unknown user or existing admin)', second.threw)
  ok('still exactly one administrator', (await count('public.profiles')) === 1)
})
await scenario('02 refuses when a protection is missing', async () => {
  await addUser(ADMIN)
  await db.exec('drop index public.profiles_single_admin')
  ok('missing unique index', (await failsWith(apply(fill(SQL02)), /profiles_single_admin is missing/)).matches)
})
await scenario('02 refuses when the guard trigger is missing', async () => {
  await addUser(ADMIN); await db.exec('drop trigger profiles_guard_write on public.profiles')
  ok('missing trigger', (await failsWith(apply(fill(SQL02)), /profiles_guard_write is missing/)).matches)
})
await scenario('02 refuses when RLS is off or the function is missing', async () => {
  await addUser(ADMIN); await db.exec('alter table public.profiles disable row level security')
  ok('RLS off', (await failsWith(apply(fill(SQL02)), /Row level security is not enabled/)).matches)
})
await scenario('02 refuses when a user token is present', async () => {
  await addUser(ADMIN); await db.exec(`select set_config('request.jwt.claims', '{"sub":"${OTHER.id}"}', true)`)
  ok('token present', (await failsWith(apply(fill(SQL02)), /carries a user token/)).matches); ok('nothing created', (await count('public.profiles')) === 0)
})
await scenario('02 the script contains no secrets and defaults to preview', async () => {
  ok('v_apply defaults to false', /v_apply\s+boolean\s+:= false;/.test(SQL02))
  ok('no password, key or connection string', !/password\s*[:=]\s*'[^']|eyJ[A-Za-z0-9_-]{20,}|sb_secret_|postgres(ql)?:\/\//i.test(SQL02))
})

// ============================================================================================ 03 verification
async function provisioned() { await addUser(ADMIN); await db.exec(apply(fill(SQL02))) }
await scenario('03 after correct provisioning', async () => {
  await provisioned()
  const r = await q(fill(SQL03))
  ok('15 checks + overall', r.length === 16)
  ok('every row PASSes', r.every((x) => x.result === 'PASS'), JSON.stringify(r.filter((x) => x.result !== 'PASS').map((x) => [x['#'], x.result])))
  ok('read-only (no DML/DDL keywords)', !FORBIDDEN.test(executableSql(SQL03)))
})
await scenario('03 NO administrator is a FAIL, never "no rows"', async () => {
  await addUser(ADMIN)
  const r = await q(fill(SQL03))
  ok('rows are returned', r.length === 16)
  ok('check 1 FAILs', row(r, 1).result === 'FAIL' && /0 administrator/.test(row(r, 1).detail)); ok('OVERALL FAIL', overall(r) === 'FAIL')
})
await scenario('03 without the intended UID/email it cannot be a full PASS', async () => {
  await provisioned()
  const r = await q(SQL03)
  ok('checks 2 and 4 are INCONCLUSIVE', row(r, 2).result === 'INCONCLUSIVE' && row(r, 4).result === 'INCONCLUSIVE'); ok('OVERALL INCONCLUSIVE', overall(r) === 'INCONCLUSIVE')
})
await scenario('03 wrong UID or wrong email', async () => {
  await provisioned()
  ok('wrong UID FAILs check 2', row(await q(fill(SQL03, { id: OTHER.id }, ADMIN.email)), 2).result === 'FAIL')
  ok('wrong email FAILs check 4', row(await q(fill(SQL03, ADMIN, 'someone.else@example.invalid')), 4).result === 'FAIL')
})
await scenario('03 Auth user later made ineligible', async () => {
  await provisioned(); await db.exec(`update auth.users set banned_until = now() + interval '1 day' where id = '${ADMIN.id}'`)
  ok('check 6 FAILs', row(await q(fill(SQL03)), 6).result === 'FAIL')
})
const grantCases = [
  ['INSERT granted to authenticated on the table', 'grant insert on public.profiles to authenticated', 8],
  ['column-level INSERT granted to anon', 'grant insert (role) on public.profiles to anon', 8],
  ['UPDATE granted to authenticated on the table', 'grant update on public.profiles to authenticated', 9],
  ['column-level UPDATE(role) granted to authenticated (role-assignment hole)', 'grant update (role) on public.profiles to authenticated', 9],
  ['DELETE granted to authenticated', 'grant delete on public.profiles to authenticated', 10],
  ['SELECT granted to anon', 'grant select on public.profiles to anon', 11],
  ['column-level SELECT(id) granted to anon', 'grant select (id) on public.profiles to anon', 11],
  ['authenticated loses SELECT on role (login would break)', 'revoke select (role) on public.profiles from authenticated', 12],
  ['EXECUTE on the provisioning function granted to anon', 'grant execute on function private.provision_administrator(uuid) to anon', 7],
  ['USAGE on private granted to authenticated', 'grant usage on schema private to authenticated', 13],
  ['an extra permissive policy on profiles', "create policy open_read on public.profiles for select to anon using (true)", 14],
  ['RLS disabled on profiles', 'alter table public.profiles disable row level security', 14],
  ['the single-admin index dropped', 'drop index public.profiles_single_admin', 15],
  ['the guard trigger dropped', 'drop trigger profiles_guard_write on public.profiles', 15],
]
for (const [label, mutation, n] of grantCases) {
  await scenario(`03 ${label}`, async () => {
    await provisioned(); await db.exec(mutation)
    const r = await q(fill(SQL03))
    ok(`check ${n} FAILs`, row(r, n).result === 'FAIL', JSON.stringify(row(r, n))); ok('OVERALL FAIL', overall(r) === 'FAIL')
  })
}
await scenario('03 attribute columns not exposed', async () => {
  await provisioned(); await db.exec('alter table auth.users drop column deleted_at, drop column is_anonymous')
  const r = await q(fill(SQL03))
  ok('check 6 is INCONCLUSIVE, not PASS', row(r, 6).result === 'INCONCLUSIVE'); ok('OVERALL INCONCLUSIVE with no FAIL', overall(r) === 'INCONCLUSIVE' && !r.some((x) => x.result === 'FAIL'))
})

// ============================================================================================ recovery path
await scenario('recovery: a hard delete frees the slot and a replacement can be provisioned', async () => {
  await provisioned()
  await db.exec(`delete from auth.users where id = '${ADMIN.id}'`)
  ok('the profile went with the Auth user (cascade)', (await count('public.profiles')) === 0)
  await addUser(OTHER)
  await db.exec(apply(fill(SQL02, OTHER)))
  ok('replacement is the single administrator', (await q("select id::text as id from public.profiles where role = 'admin'"))[0].id === OTHER.id)
  ok('and 03 PASSes for it', overall(await q(fill(SQL03, OTHER))) === 'PASS')
})
await scenario('recovery: a SOFT delete does NOT free the slot, and 01/02 catch it', async () => {
  await provisioned()
  await db.exec(`update auth.users set deleted_at = now() where id = '${ADMIN.id}'`) // what a soft delete does: the row stays
  ok('the profile is still there (nothing cascaded)', (await count('public.profiles')) === 1)
  const r = await q(fill(SQL03))
  ok('03 FAILs: the administrator account is soft-deleted but still administrator', row(r, 6).result === 'FAIL' && overall(r) === 'FAIL')
  await addUser(OTHER)
  ok('02 refuses a replacement while the old administrator remains', (await failsWith(apply(fill(SQL02, OTHER)), /Expected exactly 1 Auth user but found 2|DIFFERENT administrator/)).threw)
})

const failed = results.filter((x) => !x).length
console.log(`\n${results.length - failed}/${results.length} passed`)
process.exit(failed ? 1 : 0)
