-- =============================================================================
-- HCM Lite — 002_auth.sql (run after 001_schema.sql)
-- Spec: docs/HCM_SPEC.md §3, §4 (functionalities 01, 02, 05)
-- Plan: docs/specs/03-auth-rbac.md
--
-- Paste into the Supabase SQL Editor and run. Safe to run more than once.
-- =============================================================================

begin;

-- Everything src/proxy.js needs to route a page request, in one round trip.
-- p_user may be null (signed out).
create or replace function public.fn_proxy_state(p_user uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'setup_completed', coalesce((select cs.setup_completed from public.company_settings cs where cs.id = 1), false),
    'is_active', u.is_active,
    'must_change_password', u.must_change_password,
    'role', u.role
  )
  from (select 1) as one
  left join public.app_users u on u.id = p_user
$$;

-- First-run setup in one transaction: company row + admin app_users row.
-- Raises setup_already_completed if setup has already happened (also when two
-- setups race: only one UPDATE/INSERT can flip setup_completed).
create or replace function public.fn_complete_setup(p_user_id uuid, p_email text, p_company text)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  changed int;
begin
  insert into public.company_settings as cs (id, company_name, setup_completed)
  values (1, p_company, true)
  on conflict (id) do update
    set company_name = excluded.company_name,
        setup_completed = true
    where cs.setup_completed = false;

  get diagnostics changed = row_count;
  if changed = 0 then
    raise exception 'setup_already_completed'
      using errcode = 'P0001', detail = 'First-run setup has already been completed.';
  end if;

  insert into public.app_users (id, email, role, is_active, must_change_password)
  values (p_user_id, lower(p_email), 'admin', true, false);
end
$$;

do $$
declare
  f regprocedure;
begin
  for f in
    select p.oid::regprocedure
    from pg_catalog.pg_proc p
    join pg_catalog.pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname in ('fn_proxy_state', 'fn_complete_setup')
  loop
    execute format('revoke all on function %s from public, anon, authenticated', f);
    execute format('grant execute on function %s to service_role', f);
  end loop;
end
$$;

commit;
