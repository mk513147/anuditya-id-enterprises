-- Phase A / follow-up: stop granting API roles USAGE on the private schema.
--
-- Why this is safe: the only private function that runs under a client role is private.is_admin(), called from RLS
-- policies (and the storage policy). PostgreSQL checks EXECUTE on that function when the policy runs, not USAGE on its schema
-- (name lookup already happened when the policy was created). Triggers run their functions without re-checking EXECUTE,
-- and every other private helper is called only from SECURITY DEFINER functions, which run as the function owner.
-- The existing EXECUTE grant on private.is_admin() is deliberately left in place: policies need it.
-- service_role keeps USAGE (trusted server code); the owner is unaffected. `private` is not an exposed API schema.
--
-- Forward-only and repeatable: REVOKE of a privilege that is already absent is a no-op.

revoke usage on schema private from anon, authenticated;

do $$
begin
  if has_schema_privilege('anon', 'private', 'usage') or has_schema_privilege('authenticated', 'private', 'usage') then
    raise exception 'anon or authenticated still has USAGE on schema private (inherited from another role or PUBLIC?)';
  end if;
end
$$;
