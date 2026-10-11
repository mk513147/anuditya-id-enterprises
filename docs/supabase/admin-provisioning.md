# Provisioning the single administrator

**There is no public way to become the administrator.** The account is created by the project owner in the Supabase Dashboard and
promoted with one owner-only SQL call. Nothing in the app, a migration, the seed or a deployment creates or changes an administrator.

## How to read this document

| Label | Meaning |
| --- | --- |
| **VERIFIED (emulator)** | Executed by the tests in `supabase/verification/emulator/provisioning.test.mjs` against an in-memory PostgreSQL with stand-ins for Supabase's `auth` schema (126 checks). This proves the SQL logic, **not** hosted behaviour. |
| **NOT TESTED** | Depends on the real Supabase project or Dashboard. Nothing in this repository has been run against it. |
| **Dashboard instruction** | From general knowledge of the Dashboard. Menu and button names change, and **I have not seen your current interface**: follow the intent, not the exact wording. |

## Why this method

| Fact (from the migrations) | Consequence |
| --- | --- |
| `public.profiles` has no INSERT/UPDATE/DELETE privilege or policy for `anon` or `authenticated` (`20261011150008`). | Nobody can write a role through the API. |
| A trigger rejects profile inserts while a user token is present and any change to `id` or `role` (`20261011150002`). | Even a mistakenly widened grant cannot let a user promote themselves. |
| A partial unique index allows at most one row with `role = 'admin'` (`20261011150002`). | A second administrator is impossible. |
| `private.provision_administrator(uuid)` is not exposed to the API and is executable only by the owner and `service_role` (`20261011150002`). | Promotion needs the owner (SQL editor). No service-role key is needed in the browser or this repository. |
| `private.is_admin()` is true only when `auth.uid()` has the admin profile (`20261011150002`); every admin policy and `admin_*` function uses it. | The database, not React, decides who is the administrator. |

## Expected migration history

Provisioning needs the **14** migrations in `supabase/migrations/`, applied by a separately approved step. The applied set must be exactly:

```
20261011150001  20261011150002  20261011150003  20261011150004  20261011150005  20261011150006
20261011150007  20261011150008  20261011150009  20261011150010  20261011150011  20261011160001
20261012090001  20261013090001
```

Verify (read-only), either of:

- SQL editor: `select version from supabase_migrations.schema_migrations order by version;` (exactly the 14 rows above; none missing, none extra). `01_preflight_read_only.sql` runs this comparison for you (rows 1 and 2).
- CLI: `npx supabase migration list --linked` (read-only against the linked project): both columns show all 14.

Only the set of versions and their order can be compared; the history table does not record apply order beyond the version. If the history table does not exist, `01` reports INCONCLUSIVE: check Dashboard, Database, Migrations by hand.

## The scripts (all in `supabase/provisioning/`; none is a migration; none runs automatically)

Each script is run by pasting it into the Dashboard SQL editor as the project owner. 01 and 03 are one read-only `SELECT` each; 02 changes one row only when you set `v_apply` to true.

### `01_preflight_read_only.sql` (read-only)

Returns one row per check with `PASS`, `FAIL` or `INCONCLUSIVE`, ending with **OVERALL READINESS**.

| Rows | Checks (all read from the catalog) |
| --- | --- |
| 1-2 | Migration history table present; applied versions exactly the 14 expected (names missing and unexpected versions). |
| 3 | `private.provision_administrator(uuid)` exists with that exact signature, SECURITY DEFINER, empty `search_path`, returns void. |
| 4-5 | Unique index `profiles_single_admin` (unique, valid, one column `role`, partial on admin); trigger `profiles_guard_write` (before insert/update, per row, enabled). |
| 6-7 | RLS enabled on `public.profiles`; its only policy is `profiles_select_own` (SELECT, `authenticated`). |
| 8 | `anon` and `authenticated` have no USAGE on schema `private`. |
| 9 | `auth.uid()` is null in this session (otherwise the guard trigger would block provisioning). |
| 10-11 | Exactly one Auth user exists; no administrator profile exists yet. |
| 12-19 | **Optional:** if you fill in the UID and intended email in the first CTE: the user exists, the email matches, confirmed, not soft-deleted, not banned, not anonymous, not single-sign-on. Left as placeholders these rows are INCONCLUSIVE. |

The Auth-user attributes are read through `to_jsonb(auth.users)`, so a project whose `auth.users` lacks a column reports **INCONCLUSIVE** for it instead of failing or assuming. What I know about `auth.users` columns comes from general knowledge, not from your project (**NOT TESTED**).

**What you should see:** every row PASS (or INCONCLUSIVE only for rows 1-2 or 12-19 that you cannot or did not fill in), and OVERALL PASS or INCONCLUSIVE. **Any FAIL means stop**: the detail column says what is wrong. An INCONCLUSIVE row is not a pass: do the manual check its detail describes.

### `02_provision_administrator.sql` (changes one row, only when applied)

Two-step by design.

1. **Preview (default).** Fill in `v_user_id_text` (the UID) and `v_intended_email` (the email the administrator must have) and run. The script runs every check and then **stops with an error that begins `PREVIEW ONLY - NOTHING WAS CHANGED`**, showing the email and UID it would promote. That error is the *success* signal for this step. Compare the email with the real person.
2. **Apply.** Only if the email is right, change `v_apply` to `true` and run again. It creates the profile and the editor reports success (no rows returned).

It refuses, changing nothing, if: a placeholder remains; the UID or email is malformed; the function, the single-admin index, the guard trigger or RLS is missing; the session carries a user token; the number of Auth users is not exactly 1; the UID is not that user; the email does not match what you typed (the message shows **both** emails); the email is unconfirmed; the user is soft-deleted, banned, anonymous or single-sign-on (where the project exposes those attributes); or a **different** administrator already exists. Re-running for the same, already-provisioned administrator is a harmless no-op that prints a notice. The database's own protections (unique index, guard trigger, owner-only function) still apply underneath.

What SQL **cannot** enforce, and you must verify by hand: that the password is the strong one you chose, that the account belongs to the real person, and any attribute named under "Not verified in SQL" in the preview message.

### `03_verify_administrator.sql` (read-only)

Fill in the UID and email (first CTE) and run after step 2. One row per check, ending with **OVERALL**. A missing administrator is a **FAIL**, never an empty result.

| Rows | Checks |
| --- | --- |
| 1 | Exactly one administrator profile. |
| 2-6 | The profile is the intended Auth user (UID); the Auth user exists; its email matches; confirmed; not soft-deleted/banned/anonymous/SSO. |
| 7 | `anon` and `authenticated` cannot EXECUTE the provisioning function. |
| 8-10 | `anon` and `authenticated` have no INSERT or UPDATE (table-level **or any column**), and no DELETE or TRUNCATE, on `public.profiles`. |
| 11 | `anon` has no SELECT (table or column) on `profiles`. |
| 12 | `authenticated` **can** read `profiles.id` and `profiles.role` (the login needs this). |
| 13 | No USAGE on `private` for either client role. |
| 14-15 | RLS on and only `profiles_select_own`; the single-admin index and guard trigger exist. |

**What you should see:** OVERALL PASS. FAIL means do not use the account until fixed. These are **database grants and catalog definitions**, not runtime behaviour: grants and RLS are separate layers and neither alone proves the authorization model. The remaining proof is functional: sign in at `/admin` as the administrator (`is_admin()` depends on your own sign-in token, which SQL run here cannot present), then run `supabase/verification/verify-public-api.mjs`.

## Prerequisites

1. The 14 migrations applied (above) by a separately approved step.
2. `supabase/verification/verify-public-api.mjs` and the privilege queries in `docs/supabase/testing.md` run against the hosted project with no anonymous access found. **Do not create the administrator before that.** (That script tests the *anonymous* surface only. It says nothing about whether Dashboard user creation works.)

## Steps (you perform these; nothing here touches the hosted project)

1. **Close public sign-up. Dashboard instruction (NOT TESTED).** Authentication, sign-in settings: turn off new-user sign-up, keep anonymous sign-ins off, disable every provider except Email, set a minimum password length of 12 or more.
2. **Create the Auth user. Dashboard instruction (NOT TESTED).** Authentication, Users, Add user, create new user: the administrator's real email, a long unique password from a password manager, and auto-confirm. Do not write the password anywhere else.
   **This must be tested separately, and it is the first thing that can go wrong:** whether the Dashboard can still create a user while public sign-up is off is unproven for your project. If it cannot, stop; do not re-enable sign-up as a workaround without reviewing the risk.
3. Run `01_preflight_read_only.sql` (optionally with the UID and email filled in). Continue only without FAIL; do every manual check an INCONCLUSIVE row asks for.
4. Run `02_provision_administrator.sql` in **preview** mode. You must get the `PREVIEW ONLY` error showing the intended email. Any other error is a refusal: fix the cause.
5. Set `v_apply` to `true` and run it. Expect success with no error.
6. Run `03_verify_administrator.sql`. Expect OVERALL PASS.
7. Sign in at `https://YOUR_DOMAIN/admin` (see `authentication.md`).

## Recovery

The app deliberately has **no password-reset or sign-up screen**. Choose the case that fits.

### Forgotten password (routine)

Same person, no suspicion of compromise. **The app does not support this today.** A password reset is a **future feature**: it needs a small "set a new password" page, because the recovery link a Dashboard email sends lands on the site, where the app ignores it (`detectSessionInUrl` is off). Until that feature exists, the only supported route is the Replace procedure below (acceptable for a forgotten password; it changes the Auth user's UID but keeps all data). Decide whether you want the reset feature built.

### Compromised or unrecoverable account: **Replace** the administrator

Use when you suspect compromise, lost the mailbox, or cannot recover the account.

**Data and foreign-key risk (checked against the migrations):** the only link to `auth.users` is `profiles.id`, declared `on delete cascade` (`20261011150002`). No application table references `profiles`; every other foreign key points at `schools` or `orders`. So deleting the Auth user cannot orphan or delete application data. Not verified: whether anything in your project's `storage.objects` has an owner link to the user (**NOT TESTED**; spreadsheets and photos are written by the server, not by the administrator's account).

1. **Delete the user. Dashboard instruction (NOT TESTED).** Authentication, Users, delete the old administrator user.
2. **Do not assume it was a hard delete.** A Dashboard may offer a **soft delete** (the `auth.users` row stays and is only marked deleted). A soft delete does **not** cascade: the profile remains, the single-administrator slot stays occupied, and `is_admin()` stays true for that user's unexpired token. **Verify**, read-only:
   `select count(*) from public.profiles where role = 'admin';` must be **0**, and `select count(*) from auth.users;` must be **0** (or only the new user).
3. If both are 0, create the new Auth user and repeat the Steps above (01, 02 preview, 02 apply, 03). 02 and 03 will refuse or fail if anything is left over.
4. If the administrator profile still exists (a soft delete), **stop**. Manual profile deletion is **not the default** and is not a routine fix. Use the controlled procedure:
   - write down why (date, reason, who approved) before touching anything;
   - confirm the old Auth user can no longer sign in (it is soft-deleted or banned) and rotate its password or ban it if there is any doubt;
   - run a single targeted statement as owner: `delete from public.profiles where id = '<THE OLD ADMIN UID>' and role = 'admin';` (never `where role = 'admin'` alone);
   - re-run the read-only count above, then continue from step 3.
   Risks: this removes the database authorization immediately but does **not** end the Auth account or its sessions; a wrong UID could lock out the real administrator; a delete here is not recorded anywhere else. Nothing is lost from application data.

**Emergency lock-out** (suspected live compromise): ban or delete the Auth user first; if the profile remains, use the controlled statement above. Treat any such deletion as a security incident and record it.

### Other

- **Lost access to the Supabase owner account:** use Supabase's own account recovery; this repository cannot help.
- **Lost authenticator/MFA:** the app has no MFA yet (see below).

## What this does not cover (open risks)

- **No MFA.** The app has no TOTP enrolment screen, so the administrator relies on a strong password. Adding MFA, and requiring the `aal2` assurance level in `private.is_admin()`, is a recommended next hardening and a design decision for you.
- **Nothing here has been verified against the hosted project.** All hosted checks are yours to run; Dashboard wording is from general knowledge.
