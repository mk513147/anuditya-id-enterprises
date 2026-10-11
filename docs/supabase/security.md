# Security model (draft)

RLS being enabled is **not** a claim that the system is secure. Every policy and grant below is covered by the tests in
`supabase/tests/database/`, but they have been run only against a local emulator and have not been reviewed by a
security professional or run on a real Supabase stack. See "Known concerns" at the end.

## Principles

1. **Default deny.** Anonymous and signed-in API roles receive no table privileges by default (`alter default
   privileges … revoke`), every table is created with RLS on and explicit `revoke`, and every function revokes
   `PUBLIC` execute and grants to named roles only.
2. **Public = functions, not tables.** The browser never reads or writes a private table. It can call exactly eight
   functions (asserted by `00_security_baseline`).
3. **Least privilege for the administrator.** Column-level `GRANT`s plus RLS: the administrator can edit only the columns the
   admin screens edit; protected columns (reference numbers, school link, approval status, tracking hash) are changed only
   by trusted functions or not at all. **No role has `DELETE`.**
4. **Authorisation lives in PostgreSQL.** React route guards (Phase B) are only usability. The service-role key must never
   appear in frontend code, source, seeds, docs or migrations.

## The single administrator

- One row in `public.profiles` with `role = 'admin'`; a unique index makes a second one impossible.
- `profiles` has **no INSERT/UPDATE/DELETE privilege or policy for any API role**, and a trigger refuses profile
  inserts whenever a user token is present and refuses any change to `id` or `role`. A client can read only its own row.
- **Signup is disabled** (`supabase/config.toml`: `enable_signup = false` for Auth and email, anonymous sign-ins off,
  12-character minimum password). Even if signup were enabled by mistake, a new account would have no profile and
  `private.is_admin()` would return false, so it could read and change nothing.
- `private.is_admin()` is true only when `auth.uid()` has the admin profile. Every admin policy and every `admin_*`
  function uses it.

> The authoritative, tested procedure is now `admin-provisioning.md` (with the SQL in `supabase/provisioning/`); the steps below are a summary.

### Provisioning (one time, by the project owner, never through the app)

1. In the **hosted dashboard**, turn off "Allow new users to sign up" (the local `config.toml` change is not pushed
   automatically). Then create the administrator user (Authentication → Users → Add user) with a strong, unique password.
2. In the SQL editor, as the database owner: `select private.provision_administrator('<that user's uuid>');`
3. Record nothing in the repository: no email, uuid or password.

To replace the administrator, delete the old Auth user (the profile row goes with it), then repeat step 2.

## The `private` schema boundary (USAGE versus EXECUTE)

PostgreSQL has two separate permissions here, and both matter:

- **USAGE on a schema** lets a role *look up* objects inside it by name (`private.is_admin`).
- **EXECUTE on a function** lets a role *call* it.

Policy: **`anon` and `authenticated` have no USAGE on `private`** (migration `20261011160001_restrict_private_schema_usage.sql`;
`service_role` keeps it for trusted server code). They keep **EXECUTE on `private.is_admin()` only**, because RLS policies and the
storage policy call it under the querying role: PostgreSQL resolves the schema name when the policy is created and checks
EXECUTE on the function when the policy runs, so policies keep working without USAGE. Everything else in `private` is called
only by SECURITY DEFINER functions (which run as the function owner) or by triggers, so no client role needs any access to it.

Effects: a client role that runs `select private.is_admin()` directly now gets "permission denied for schema private", but
admin policies are unaffected. `private` must still never be an exposed API schema. Any future helper that a *client-role* query
must call (a policy, a column default, a security-invoker view) needs EXECUTE for that role; keep all other helpers behind
SECURITY DEFINER functions.

Evidence and its limit: the emulator showed all admin reads and writes through policies still working with USAGE revoked, and
breaking if EXECUTE on `is_admin()` is revoked from `authenticated`. It did **not** exercise the real Supabase Storage API, so
the storage policy (`…0011_private_storage.sql:24-26`) must be re-verified on the hosted project after the migration is applied.

## Row Level Security matrix

| Data | anon | signed-in, not admin | administrator |
| --- | --- | --- | --- |
| `profiles` | none | own row | own row |
| `schools` | none (functions return id/name only) | none | read, create, edit, activate |
| `students` | none | none | read, edit whitelisted columns, archive, approve/reject via function |
| `orders`, `order_status_history` | none | none | read (never the hash); change via functions |
| `uploaded_files` | none | none | read metadata |
| `services`, `advertisements` | functions return only visible rows | none | read, create, edit |
| `feedback` | function returns approved only | none | read, change status |
| Storage objects | none | none | read (for signed URLs) |

## Public operations

| Operation | Function | What it guarantees |
| --- | --- | --- |
| Active schools | `list_active_schools()` | Only `id` and `name`. No contact person, phone, email or address. |
| School link | `resolve_school(slug)` | One row: `active` (with id/name/slug), `inactive` or `not_found` (nothing else revealed). |
| Services | `list_enabled_services()` | Disabled services never leave the database. |
| Advertisements | `list_published_advertisements()` | Enabled, published, started and not ended, using the database clock. No internal flags. |
| Approved feedback | `list_approved_feedback(limit)` | Approved only; capped at 100; no status column. |
| Student submission | `submit_student(...)` | No status argument exists. The row is inserted as `pending` by the function itself, the school must be active, every rule is a CHECK constraint, the reference number is generated server-side. |
| Feedback submission | `submit_feedback(...)` | Always `pending`. |
| Order tracking | `track_order(order_no, code)` | See below. |

## Order tracking secret

- **Format:** 25 characters from a 32-letter alphabet without look-alikes (no I, O, 0, 1), shown as five groups of five
  (`XXXXX-XXXXX-XXXXX-XXXXX-XXXXX`): **125 bits** from the database's cryptographic RNG (`gen_random_bytes`), with no modulo bias.
- **Storage:** only `sha256(order_id || ':' || code)` is stored in `orders.tracking_secret_hash`. The plaintext cannot be
  recovered. SHA-256 (not a slow password hash) is appropriate because the secret is random with 125 bits of entropy.
  Binding the hash to the order id means two orders can never share a hash. The hash column is not readable by any API role.
- **Issuing:** `admin_create_order(...)` returns the plaintext code **once**, to the signed-in administrator. The admin
  gives it to the customer (for example printed on the order slip or sent on WhatsApp together with the order number).
  The app never shows it again. If it is lost, `admin_rotate_tracking_code(order_id)` issues a new one and the old one stops working.
- **Verification:** the order number is normalised the same way as today (`src/lib/orderReference.ts`) and the code is
  normalised to letters and digits (case, spaces and dashes are tolerated). Unknown order, wrong code, malformed code,
  other order's code and "order has no code" all return **zero rows** with the same work done, so nothing reveals which
  order numbers exist. The result is the same whitelist the app shows today: no notes, id, history or hash.
- **Legacy/imported orders** have no hash and therefore cannot be tracked until an administrator issues a code.

## Private files

- Buckets `student-photos` (2 MB, JPEG/PNG) and `school-uploads` (10 MB, xlsx/xls/csv) are **private**. There is no
  policy for `anon`; the only storage policy lets the administrator `SELECT` (what `createSignedUrl` needs).
  There are no client insert/update/delete policies: Phase B server code writes with the service role and sets the content type itself.
- File rows say `metadata_only` until an object exists. A `stored` row must name a bucket and path (CHECK constraint).

## Known concerns (not solved in Phase A)

1. **No abuse protection on anonymous writes.** `submit_student` and `submit_feedback` can be called directly by anyone
   with the public key. They cannot leak data or skip approval, but they can be used to spam the pending queue.
   *Planned:* Phase B puts them behind a server function with bot protection and rate limits, then revokes the direct anon
   grant (one `revoke execute` line).
2. **Tracking has no rate limit.** The 125-bit secret makes guessing infeasible, but throttling should still be added in Phase B.
3. **The school link is not a secret** (documented in `docs/school-links.md`); anyone with it can submit for that school. The approval step is the control.
4. **Spreadsheets and photos contain data about minors.** Retention, deletion, consent and virus scanning are open
   decisions (decisions.md). Malicious spreadsheets (formula injection) are a risk for whoever opens a downloaded file.
5. **Image links** are accepted over `http` as well as `https` (today's rule); `http` images are blocked as mixed content and can track visitors.
6. **`private` must never be exposed.** It must stay out of `[api] schemas` in `config.toml` and in the hosted API settings.
7. **Function inputs are validated by CHECK constraints** that use a permissive character rule for names (no digits or `<>`),
   because the app's strict Unicode rule cannot be expressed portably in PostgreSQL. The strict zod rules stay in the app.
8. **Testing limits:** see testing.md. These tests ran in a Postgres emulator with a stand-in for Supabase's `auth`/`storage`
   schemas, not on a real Supabase stack.
9. **No audit log** of who changed what (single administrator; reconsider if that changes).
10. **Sequences can leave gaps** in reference numbers after a failed insert.
11. **Dependency note for hosted config:** `supabase config push` would apply `config.toml` to the linked project. It was
    deliberately not run, and the project in `supabase/.temp` is linked to a remote, so never run `db push`, `db reset --linked`
    or `config push` without reviewing the exact target.
