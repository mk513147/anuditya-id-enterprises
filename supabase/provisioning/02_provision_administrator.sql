-- STATE-CHANGING (creates one profile row) ONLY when v_apply is set to true. Run by the project owner in the Supabase
-- Dashboard SQL editor, after 01_preflight_read_only.sql shows no FAIL. This file is not a migration and is never run automatically.
--
-- TWO-STEP USE
--   Step 1 (PREVIEW, the default): fill in the two values below and run. Every check runs, then the script STOPS WITH AN
--          ERROR that begins "PREVIEW ONLY - NOTHING WAS CHANGED" and shows the email and UID it WOULD promote.
--          That error is the success signal for the preview. Compare the email with the person you intend to make administrator.
--   Step 2 (APPLY): only if the email is right, change v_apply to true and run again. It then creates the profile and finishes
--          without an error (the editor says success). Run 03_verify_administrator.sql next.
--
-- What it enforces in SQL (it raises an error and changes nothing if any of these fails):
--   * both values filled in (no placeholders), the UID is a well-formed UUID;
--   * the provisioning function, the single-admin unique index and the profile guard trigger exist, and RLS is on for profiles;
--   * this session carries no user token (auth.uid() is null);
--   * EXACTLY ONE Auth user exists, it has the UID you gave, and its email equals the intended email you typed;
--   * that user's email is confirmed, and (where this project's auth.users exposes the attribute) it is not soft-deleted,
--     banned, anonymous or a single-sign-on user;
--   * no OTHER administrator profile exists (the function and a unique index also refuse a second administrator).
-- Re-running for the same, already-provisioned administrator changes nothing (it reports a notice and stops).
--
-- What SQL cannot enforce, so YOU must verify in the Dashboard: that the password is the strong one you set, that the account
-- belongs to the real person, and any attribute listed in the preview message as "not verified".
-- It never creates a user, sets a password, or stores a secret. Do not commit a real UID or email to this file.

do $$
declare
  v_apply          boolean := false;                    -- false = preview (default). true = apply.
  v_user_id_text   text    := '<ADMIN_AUTH_USER_UID>';  -- the Auth user's UID (Authentication > Users)
  v_intended_email text    := '<INTENDED_ADMIN_EMAIL>'; -- the email the administrator MUST have; typed by you, compared with the account

  v_user_id        uuid;
  v_total_users    integer;
  v_j              jsonb;
  v_email          text;
  v_unverified     text[] := '{}';
begin
  -- 1. Inputs -----------------------------------------------------------------------------------------------------------
  if v_user_id_text like '<%' or v_intended_email like '<%' then
    raise exception 'Fill in BOTH v_user_id_text and v_intended_email first (a placeholder is still in place).';
  end if;
  if lower(btrim(v_user_id_text)) !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
    raise exception 'v_user_id_text is not a well-formed UUID.';
  end if;
  if btrim(v_intended_email) !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' then
    raise exception 'v_intended_email is not a plausible email address.';
  end if;
  v_user_id := lower(btrim(v_user_id_text))::uuid;

  -- 2. The database protections the design relies on must actually be present --------------------------------------------
  if to_regprocedure('private.provision_administrator(uuid)') is null then
    raise exception 'private.provision_administrator(uuid) does not exist: the migrations are not (fully) applied.';
  end if;
  if not exists (
    select 1 from pg_index i join pg_class ic on ic.oid = i.indexrelid
    where i.indrelid = to_regclass('public.profiles') and ic.relname = 'profiles_single_admin' and i.indisunique and i.indisvalid
  ) then
    raise exception 'The unique index profiles_single_admin is missing: refusing to provision without the single-administrator guarantee.';
  end if;
  if not exists (
    select 1 from pg_trigger t
    where t.tgrelid = to_regclass('public.profiles') and t.tgname = 'profiles_guard_write' and not t.tgisinternal and t.tgenabled = 'O'
  ) then
    raise exception 'The trigger profiles_guard_write is missing or disabled: refusing to provision.';
  end if;
  if not coalesce((select c.relrowsecurity from pg_class c where c.oid = to_regclass('public.profiles')), false) then
    raise exception 'Row level security is not enabled on public.profiles: refusing to provision.';
  end if;
  if auth.uid() is not null then
    raise exception 'This SQL session carries a user token (auth.uid() is not null). Provisioning must run as the project owner with no user token.';
  end if;

  -- 3. Exactly one Auth user, and it is the intended one ----------------------------------------------------------------
  select count(*) into v_total_users from auth.users;
  if v_total_users <> 1 then
    raise exception 'Expected exactly 1 Auth user but found %. Create exactly one administrator user (and remove any other) before provisioning.', v_total_users;
  end if;
  select to_jsonb(u) into v_j from auth.users u where u.id = v_user_id;
  if v_j is null then
    raise exception 'No Auth user has UID %. The single existing user is a different account: re-check the UID.', v_user_id;
  end if;
  v_email := v_j ->> 'email';
  if lower(btrim(coalesce(v_email, ''))) <> lower(btrim(v_intended_email)) then
    raise exception 'EMAIL MISMATCH. The account with UID % has email "%", not the intended "%". Nothing was changed.', v_user_id, coalesce(v_email, '(none)'), btrim(v_intended_email);
  end if;

  -- 4. Account eligibility (only attributes this project actually exposes can be checked) -------------------------------------
  if not jsonb_path_exists(v_j, '$.email_confirmed_at') then
    raise exception 'auth.users does not expose email_confirmed_at here, so confirmation cannot be verified in SQL. Verify it in the Dashboard and ask for a different procedure.';
  end if;
  if v_j ->> 'email_confirmed_at' is null then
    raise exception 'The account''s email is not confirmed. Tick "Auto Confirm User" when creating it, or confirm it in the Dashboard.';
  end if;
  if jsonb_path_exists(v_j, '$.deleted_at') then
    if v_j ->> 'deleted_at' is not null then raise exception 'The account is soft-deleted (deleted_at is set).'; end if;
  else
    v_unverified := v_unverified || 'not soft-deleted';
  end if;
  if jsonb_path_exists(v_j, '$.banned_until') then
    if v_j ->> 'banned_until' is not null and (v_j ->> 'banned_until')::timestamptz > now() then raise exception 'The account is banned until %.', v_j ->> 'banned_until'; end if;
  else
    v_unverified := v_unverified || 'not banned';
  end if;
  if jsonb_path_exists(v_j, '$.is_anonymous') then
    if v_j ->> 'is_anonymous' not in ('false', 'f') then raise exception 'The account is an anonymous sign-in, not an email-and-password administrator.'; end if;
  else
    v_unverified := v_unverified || 'not anonymous';
  end if;
  if jsonb_path_exists(v_j, '$.is_sso_user') then
    if v_j ->> 'is_sso_user' not in ('false', 'f') then raise exception 'The account is a single-sign-on user, not an email-and-password administrator.'; end if;
  else
    v_unverified := v_unverified || 'not single-sign-on';
  end if;

  -- 5. Administrator conflicts --------------------------------------------------------------------------------------------
  if exists (select 1 from public.profiles p where p.role = 'admin' and p.id <> v_user_id) then
    raise exception 'A DIFFERENT administrator already exists. Only one is allowed. Use the replacement procedure in docs/supabase/admin-provisioning.md.';
  end if;
  if exists (select 1 from public.profiles p where p.role = 'admin' and p.id = v_user_id) then
    raise notice 'This user is already the administrator: nothing to do (safe to re-run). Run 03_verify_administrator.sql.';
    return;
  end if;

  -- 6. Preview or apply ---------------------------------------------------------------------------------------------------
  if not v_apply then
    raise exception 'PREVIEW ONLY - NOTHING WAS CHANGED. All checks passed. This would make the account % (UID %) the single administrator. Not verified in SQL (check in the Dashboard): %. If the email is the one you intend, set v_apply to true and run again.',
      v_email, v_user_id, coalesce(nullif(array_to_string(v_unverified, ', '), ''), 'nothing further');
  end if;

  perform private.provision_administrator(v_user_id);

  if not exists (select 1 from public.profiles p where p.id = v_user_id and p.role = 'admin') then
    raise exception 'Provisioning returned but the administrator profile is not there. Nothing is trusted: investigate before continuing.';
  end if;
  raise notice 'DONE: % (UID %) is now the administrator. Run 03_verify_administrator.sql.', v_email, v_user_id;
end
$$;
