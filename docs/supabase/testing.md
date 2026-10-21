# Database security tests

Eleven pgTAP-style test files in `supabase/tests/database/` with 452 assertions in total (28 + 28 + 37 + 51 + 52 + 38 + 42 + 42 + 47 + 41 + 46).
`10_public_school_image_submissions.test.sql` covers migration 16 (public school-image submissions: the insert-only `submissions/` storage policy, `submit_school_image`, the duplicate rule shared with administrator uploads, review, primary only when approved).
`09_school_images.test.sql` covers migration 15 (school images). Run them all with
`node supabase/verification/emulator/run-db-tests.mjs` after `npm install --no-save @electric-sql/pglite` (or set `PGLITE_ROOT`).
`08_school_file_submissions.test.sql` covers migration 14 (public submission limits, privacy of contact details and notes, the review function, history, summary counts, records made before the migration).
`07_phase3_uploads_and_summary.test.sql` covers migration 13 (insert-only uploads, photo/file registration, `admin_summary`).
Each file runs inside `begin; … rollback;`, creates only fictional fixtures and leaves nothing behind.

| File | Covers |
| --- | --- |
| `00_security_baseline` | RLS on every table, **no USAGE on `private` for anon/authenticated (service_role keeps it; authenticated keeps EXECUTE on `is_admin()`)**, **anon holds no table/column privileges**, no DELETE for any client role, exactly which functions anon/authenticated may execute, empty `search_path` on every SECURITY DEFINER function, public function result shapes (no contact details, no notes), buckets private. |
| `01_admin_authorization` | One administrator only, cannot self-assign, **client roles cannot call `private.is_admin()` directly (the check of who is the administrator runs as the owner with the simulated user token)**, profiles unwritable from the API, stranger/anon refused by admin functions. |
| `02_public_reads` | Anonymous reads of schools, services, advertisements (draft, disabled, future, expired hidden) and approved feedback; admin changes appear instantly. |
| `03_student_submission_approval` | Always pending, status not suppliable, inactive/unknown school refused, validation in the database, public cannot read students, administrator approves/rejects/reverses, whitelisted edits, admission-number rule on change, immutable reference number. |
| `04_order_tracking` | Code format, only a hash stored, correct/incorrect/other-order/partial/injection inputs, orders without a code, status history, no direct status updates, hash unreadable, code rotation. |
| `05_private_files_storage` | Private buckets and limits, no anon storage policy, anon/stranger cannot read/upload/delete, admin read-only, file-record consistency rules. |
| `06_admin_content_management` | Public feedback submission pending, school/service/advertisement constraints (unsafe links, schedule order, duplicates), admin cannot delete, stranger cannot manage content. |

## How to run

**Local Supabase stack (optional; needs Docker, which is not currently available).** Use the LOCAL stack only:

```
npx supabase start          # local containers; does not touch the hosted project
npx supabase db reset       # local only: applies migrations and seed.sql  (NEVER add --linked)
npx supabase test db        # runs supabase/tests/database/*.sql with pgTAP (its runner also needs Docker)
```

**Hosted development project: these test files have NOT been run there, and are not safe to run there as written.**
They assume an empty project (`00_security_baseline` expects exactly nine public tables; `03_student_submission_approval`
expects exact row counts), they call `private.provision_administrator`, which fails if a real administrator already exists,
they consume reference-number sequence values (a rollback does not return them), and `05_private_files_storage` issues
`delete from storage.objects`, which real Supabase may reject [unverified]. pgTAP is also not installed on hosted projects.
Do not paste them into the Dashboard SQL editor. A hosted-safe variant (guarded against existing data, self-contained, rolled back)
has to be written first.

Never run `db push`, `db reset --linked`, `config push` or anything with `--linked` without reviewing the exact target:
`supabase/.temp` shows this folder is linked to a hosted project.

**What was actually run for this draft.** Docker and the CLI's database commands were not available, so the migrations and
all seven test files were executed in an in-memory PostgreSQL emulator (PGlite) from a scratch folder outside the repo
(`scratchpad`, not part of the project). That harness:
- creates the `anon`/`authenticated`/`service_role` roles with Supabase's default grants, a minimal `auth.users`/`auth.uid()`,
  and `storage.buckets`/`storage.objects` with RLS on;
- supplies a tiny pgTAP-compatible set of functions (`plan`, `ok`, `is`, `isnt`, `throws_ok`, `lives_ok`, `is_empty`, `finish`).

Results of the latest local emulator run: all 16 migrations apply in order, `seed.sql` loads, **452 assertions pass, 0 fail**.
**Mutation check:** seven deliberate weakenings (anon `SELECT` on students, RLS disabled on orders, anon execute on an admin
function, tracking that ignores the code, public bucket, an anon storage policy, update grant on the approval column) were
each caught by at least one test.

**Limits (be honest about them).** This is not evidence for real Supabase behaviour: GoTrue, PostgREST (JWT claim handling,
column-privilege errors), the real `storage` schema and pgTAP itself were not involved. The Unicode letter class `[[:alpha:]]`
depends on the database locale. The real pgTAP `is`/`throws_ok` signatures were mirrored, not run. Re-run the suite on the
local Supabase stack before relying on it.

## Administrator provisioning scripts: how they are tested

`supabase/provisioning/01_preflight_read_only.sql`, `02_provision_administrator.sql` and `03_verify_administrator.sql` (procedure:
`admin-provisioning.md`) are tested in two ways. **Neither has been run against the hosted project.**

- **Executable, in the PostgreSQL emulator:** `supabase/verification/emulator/provisioning.test.mjs` runs the real SQL files against the 13
  migrations: **126 checks**. They cover zero and multiple Auth users, a wrong UID, a wrong intended email, unconfirmed/soft-deleted/banned/anonymous/SSO
  users, a missing/extra migration version, an absent history table, a missing index, trigger or policy, RLS off, incorrect or column-level grants,
  a missing administrator (FAIL, not "no rows"), `auth.users` columns that a project does not expose (INCONCLUSIVE, never assumed), the preview and
  apply steps, idempotent re-runs, a second administrator being refused, and the hard-delete and soft-delete recovery paths. Deliberately breaking
  the scripts makes the tests fail (checked). Run it with `npm install --no-save @electric-sql/pglite` (not a project dependency), then
  `node supabase/verification/emulator/provisioning.test.mjs` (set `PGLITE_ROOT` if the package is installed elsewhere). Its `prelude.sql` stands in
  for Supabase's `auth`, `storage` and migration-history tables, so it proves the SQL logic and **not** hosted Supabase behaviour.
- **Static, in the application test suite:** `src/features/auth/provisioning.static.test.ts` keeps the 13 versions listed in `01` identical to
  `supabase/migrations/`, checks that `01` and `03` are one read-only `SELECT`, that `02` defaults to a preview and uses only the existing owner-only
  function, that no UID, email, password or key is committed, and that `admin-provisioning.md` still documents every required point.

## Public API check script (read-only)

`supabase/verification/verify-public-api.mjs` probes the Data API with the anonymous/publishable key only (Node 21.7+ for the built-in
`.env` parser, no dependencies). It makes GET reads, POSTs to a fixed allow-list of **read-only** RPCs and one storage LIST per private
bucket. It never calls a `submit_*` function, writes nothing, refuses a service-role/secret key, requires HTTPS, and never prints the
key, the project URL or any returned row. Its own tests run it against a local fake API: `npx vitest run supabase/verification`.

Configuration, per setting (values are never printed; the output says only which NAME each came from):

1. `SUPABASE_URL` / `SUPABASE_ANON_KEY` in the process environment, when supplied (they always win);
2. otherwise `<repo root>/.env.local`: `VITE_SUPABASE_URL` / `VITE_SUPABASE_PUBLISHABLE_KEY` (the app's own names, no renaming needed),
   or `SUPABASE_URL` / `SUPABASE_ANON_KEY` in that file.

```
node supabase/verification/verify-public-api.mjs --check-get-refused
node supabase/verification/verify-public-api.mjs --check-get-refused --order-no=<an existing order number>
```

The URL must be the bare origin (no `/rest/v1`, query or fragment). Before any check, a preflight call proves the URL and key form a
usable configuration; an unreachable host (DNS/TLS/connection), a rejected key or a non-Supabase answer stops the run.

Verdicts: **PASS** (intended behaviour demonstrated), **FAIL** (private rows returned, or a call that must be denied succeeded),
**INCONCLUSIVE** (nothing bad seen, but it cannot prove the claim; never a pass), **UNEXPECTED** (network error or an odd response),
**CONFIGURATION ERROR** (could not start). Exit code: 0 all pass, 1 any FAIL, 3 no FAIL but something inconclusive/unexpected,
2 configuration error.

- **Direct table reads** (all nine application tables): a permission denial (SQLSTATE 42501, or 401/403 saying "permission denied") is a
  PASS. A bare 401 is **not** counted as a denial, because an invalid key produces one too. Rows are a FAIL; an empty success is
  INCONCLUSIVE; "not found" is UNEXPECTED.
- **Public RPCs** (`list_enabled_services`, `list_active_schools`, `list_published_advertisements`, `list_approved_feedback`): callable, and
  any column outside the function's public column list is a FAIL. `resolve_school` with a fabricated slug must return one bare `not_found`.
- **Administrator RPCs** (including `admin_summary`, which exists only after migration 13): success is a FAIL; denial is a PASS; "function not
  found" is INCONCLUSIVE.
- **`track_order`** (POST, JSON body, fabricated values only): nothing may be returned for an unknown number, a malformed code or empty
  values; and the order number alone (no code parameter) must not match any function. Whether a wrong code is refused for a **real** order
  can only be shown with `--order-no=` (order numbers are not secret); without it that claim is reported INCONCLUSIVE. The correct-code
  path is covered by the database tests, not by this script.
- **Storage LIST** of both private buckets: objects listed is a FAIL; an empty list or "bucket not found" is INCONCLUSIVE.
- **`private.is_admin` probe is preliminary evidence only.** It can only FAIL (a 2xx means the schema looks exposed) or be INCONCLUSIVE.
  Confirm in Dashboard, Settings, API, Exposed schemas.

### Read-only SQL: privilege checks (run in the Dashboard SQL editor; these queries change nothing)

These read the catalog only. They show **privileges**, not Row Level Security policy behaviour, so on their own they do not verify every policy.

```sql
-- 1. Can anon SELECT from the four private tables? Expected: every column below is false.
select t.table_name,
       has_table_privilege('anon', format('public.%I', t.table_name), 'SELECT')       as anon_table_select,
       has_any_column_privilege('anon', format('public.%I', t.table_name), 'SELECT')  as anon_any_column_select
from (values ('students'), ('orders'), ('profiles'), ('uploaded_files')) as t(table_name)
order by t.table_name;

-- 2. Which public-API functions can anon execute? Expected: the four admin_* rows false, list_enabled_services and track_order true.
select p.proname, has_function_privilege('anon', p.oid, 'EXECUTE') as anon_can_execute
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname in ('list_enabled_services', 'track_order', 'admin_create_order', 'admin_review_student',
                    'admin_rotate_tracking_code', 'admin_set_order_status')
order by p.proname;
```

A `false` in query 1 means anon holds no SELECT privilege, which is what makes
the "explicit denial" in the script expected; it does not show that an authenticated user or the administrator sees the right rows.

## Executable manual checks for a real project (after applying to a **scratch/staging** project, never production)

With the anon key only (use `curl` or the JS client), each of these must hold. The tracking code is a secret: call
`track_order` only with POST and a JSON body, never as a GET or a URL with query parameters (the function is VOLATILE, so PostgREST should refuse GET).

1. `GET /rest/v1/students` and `/orders`, `/schools`, `/uploaded_files`, `/profiles`, `/feedback` → permission denied or empty. 
2. `POST /rest/v1/rpc/list_active_schools` → ids and names only.
3. `POST /rest/v1/rpc/track_order` with a JSON body, `GET /rest/v1/rpc/track_order?...` → expected to be refused (exact status code unverified), and with a real order number and a wrong code → `[]`; with the right code → one row without notes.
4. `POST /rest/v1/rpc/submit_student` → returns a reference; the row is `pending` (check as admin); supplying an extra `approval_status` key is rejected as an unknown argument.
5. `GET /storage/v1/object/public/school-uploads/<path>` → 400/404; `POST /storage/v1/object/sign/school-uploads/<path>` with the anon key → denied.
6. Sign up via `POST /auth/v1/signup` → refused (signup disabled).
As the administrator: approve a pending student, create an order (record the one-time code), track it anonymously, rotate the code, request a signed URL for a stored spreadsheet → succeeds only with the administrator's token.
