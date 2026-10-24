-- =============================================================================
-- HCM Lite — 003_employees.sql (run after 002_auth.sql)
-- Spec: docs/HCM_SPEC.md §4 (functionalities 06, 07, 08, 14), §5
-- Plan: docs/specs/05-employees.md
--
-- Paste into the Supabase SQL Editor and run. Safe to run more than once.
-- Functions only: no table changes.
-- =============================================================================

begin;

-- CSV import may supply its own codes (EMP-0042), so the generator skips any
-- code that is already taken instead of failing on the unique index.
create or replace function public.fn_next_employee_code()
returns text
language plpgsql
volatile
set search_path = ''
as $$
declare
  n bigint;
  code text;
begin
  loop
    n := nextval('public.employee_code_seq');
    code := 'EMP-' || lpad(n::text, greatest(4, length(n::text)), '0');
    exit when not exists (select 1 from public.employees e where e.employee_code = code);
  end loop;
  return code;
end
$$;

-- Registers 1..N employees in one transaction (single register and CSV import).
-- The auth users already exist (created by the server with the Auth admin API);
-- if anything here fails nothing is kept and the server deletes those auth users.
--
-- p_rows: [{ user_id, link, employee_code, full_name, email, phone, address, gender,
--            date_of_birth, department_id, designation_id, join_date, status, basic }]
--   link = true: user_id is an existing HR/Admin login that gets this employee record
--               (role and password unchanged); otherwise a new employee login row is made.
-- Returns [{ id, employee_code, email }] in input order.
create or replace function public.fn_register_employees(p_rows jsonb, p_actor uuid)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  r jsonb;
  emp public.employees;
  linked int;
  result jsonb := '[]'::jsonb;
begin
  for r in select value from jsonb_array_elements(p_rows) loop
    insert into public.employees (
      employee_code, user_id, full_name, email, phone, address, gender, date_of_birth,
      department_id, designation_id, join_date, status
    ) values (
      coalesce(nullif(r->>'employee_code', ''), public.fn_next_employee_code()),
      (r->>'user_id')::uuid,
      r->>'full_name',
      lower(r->>'email'),
      nullif(r->>'phone', ''),
      nullif(r->>'address', ''),
      nullif(r->>'gender', '')::public.gender,
      nullif(r->>'date_of_birth', '')::date,
      (r->>'department_id')::uuid,
      nullif(r->>'designation_id', '')::uuid,
      (r->>'join_date')::date,
      coalesce(nullif(r->>'status', ''), 'probation')::public.employee_status
    )
    returning * into emp;

    if coalesce((r->>'link')::boolean, false) then
      update public.app_users u
         set employee_id = emp.id
       where u.id = emp.user_id
         and u.employee_id is null
         and u.role in ('admin', 'hr');
      get diagnostics linked = row_count;
      if linked = 0 then
        raise exception 'login_not_linkable'
          using errcode = 'P0001', detail = 'That login already has an employee record or is not an HR/Admin login.';
      end if;
    else
      insert into public.app_users (id, email, role, is_active, must_change_password, employee_id)
      values (emp.user_id, emp.email, 'employee', true, true, emp.id);
    end if;

    insert into public.salary_structures (employee_id, basic, effective_from, created_by)
    values (emp.id, (r->>'basic')::numeric, emp.join_date, p_actor);

    result := result || jsonb_build_array(
      jsonb_build_object('id', emp.id, 'employee_code', emp.employee_code, 'email', emp.email)
    );
  end loop;
  return result;
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
      and p.proname in ('fn_next_employee_code', 'fn_register_employees')
  loop
    execute format('revoke all on function %s from public, anon, authenticated', f);
    execute format('grant execute on function %s to service_role', f);
  end loop;
end
$$;

commit;
