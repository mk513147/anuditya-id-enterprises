// Runs supabase/tests/database/*.test.sql in an in-memory PostgreSQL emulator (PGlite), after applying every migration
// and the local seed. NOT Supabase: auth/storage are stand-ins (prelude.sql), so this proves the SQL, not hosted behaviour.
//
//   npm install --no-save @electric-sql/pglite        (not a project dependency)
//   node supabase/verification/emulator/run-db-tests.mjs [file-filter]
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
const only = process.argv[2]

const db = new PGlite({ extensions: { pgcrypto, pg_trgm } })
await db.exec(fs.readFileSync(path.join(HERE, 'prelude.sql'), 'utf8'))
for (const f of fs.readdirSync(path.join(SUPABASE, 'migrations')).filter((x) => x.endsWith('.sql')).sort()) {
  try {
    await db.exec(fs.readFileSync(path.join(SUPABASE, 'migrations', f), 'utf8'))
    console.log(`migration ok   ${f}`)
  } catch (e) {
    console.log(`migration FAIL ${f}\n   ${e.message}`)
    process.exit(2)
  }
}
try {
  await db.exec(fs.readFileSync(path.join(SUPABASE, 'seed.sql'), 'utf8'))
  console.log('seed ok        seed.sql')
  // The tests create their own fixtures; the seed only has to load cleanly.
  await db.exec('delete from public.schools; delete from public.services;')
} catch (e) {
  console.log(`seed FAIL      ${e.message}`)
  process.exit(2)
}

let failed = 0
let total = 0
const dir = path.join(SUPABASE, 'tests/database')
for (const f of fs.readdirSync(dir).filter((x) => x.endsWith('.test.sql') && (!only || x.includes(only))).sort()) {
  console.log(`\n${f}`)
  try {
    await db.exec('set search_path to public, extensions, pgtap_shim')
    const results = await db.exec(fs.readFileSync(path.join(dir, f), 'utf8'))
    const lines = results.flatMap((r) => r.rows.map((row) => row.finish).filter((v) => typeof v === 'string'))
    for (const l of lines) if (l.startsWith('not ok') || l.startsWith('# Looks like')) console.log(`  ${l}`)
    const summary = lines.find((l) => l.startsWith('# summary'))
    console.log(`  ${summary ?? '# no summary (the file did not reach finish())'}`)
    const m = summary?.match(/(\d+) ran, (\d+) failed/)
    if (!m || Number(m[2]) > 0) failed++
    total += m ? Number(m[1]) : 0
  } catch (e) {
    console.log(`  ERROR: ${e.message}`)
    failed++
    await db.exec('rollback').catch(() => {})
  }
}
console.log(`\n${failed ? `FAILED (${failed} file(s))` : 'ALL TESTS PASSED'}: ${total} assertions run`)
process.exitCode = failed ? 1 : 0
