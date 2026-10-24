-- =============================================================================
-- HCM Lite — self-checks for 002_auth.sql
-- Safe on any database: runs in one transaction that is ROLLED BACK.
-- Expected output on success: one row "ALL AUTH CHECKS PASSED".
-- =============================================================================

begin;

do $$
declare
  admin_id uuid := gen_random_uuid();
  state jsonb;
  failed boolean := false;
begin
  -- Fresh install (no company_settings row): setup not completed, nobody signed in.
  delete from public.app_users;
  delete from public.company_settings;
  state := public.fn_proxy_state(null);
  if (state->>'setup_completed')::boolean is distinct from false or state->>'role' is not null then
    raise exception 'FAIL: fresh install state %', state;
  end if;

  insert into auth.users (id, email) values (admin_id, 'check-admin@example.test');
  perform public.fn_complete_setup(admin_id, 'Check-Admin@Example.test', 'Check Co');

  state := public.fn_proxy_state(admin_id);
  if not (state->>'setup_completed')::boolean
     or state->>'role' <> 'admin'
     or not (state->>'is_active')::boolean
     or (state->>'must_change_password')::boolean then
    raise exception 'FAIL: state after setup %', state;
  end if;
  if (select email from public.app_users where id = admin_id) <> 'check-admin@example.test' then
    raise exception 'FAIL: admin email is stored lower-case';
  end if;
  if (select company_name from public.company_settings where id = 1) <> 'Check Co' then
    raise exception 'FAIL: company name saved';
  end if;

  -- Second setup must be refused and must not change the company name.
  begin
    perform public.fn_complete_setup(gen_random_uuid(), 'other@example.test', 'Other Co');
    failed := true;
  exception when others then
    if sqlerrm <> 'setup_already_completed' then
      raise exception 'FAIL: second setup raised % instead of setup_already_completed', sqlerrm;
    end if;
  end;
  if failed then
    raise exception 'FAIL: second setup succeeded';
  end if;
  if (select company_name from public.company_settings where id = 1) <> 'Check Co' then
    raise exception 'FAIL: second setup changed the company name';
  end if;

  if pg_catalog.has_function_privilege('anon', 'public.fn_complete_setup(uuid,text,text)', 'EXECUTE')
     or pg_catalog.has_function_privilege('anon', 'public.fn_proxy_state(uuid)', 'EXECUTE') then
    raise exception 'FAIL: anon can execute auth functions';
  end if;
end
$$;

rollback;

select 'ALL AUTH CHECKS PASSED' as result;
