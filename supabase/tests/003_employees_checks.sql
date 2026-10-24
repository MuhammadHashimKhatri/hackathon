-- =============================================================================
-- HCM Lite — self-checks for 003_employees.sql
-- Safe on any database: runs in one transaction that is ROLLED BACK.
-- Expected output on success: one row "ALL EMPLOYEE CHECKS PASSED".
-- =============================================================================

begin;

do $$
declare
  dept uuid;
  emp_user uuid := gen_random_uuid();
  hr_user uuid := gen_random_uuid();
  bad_user uuid := gen_random_uuid();
  out jsonb;
  emp_id uuid;
  employees_before int;
  next_code text;
  taken_code text;
  failed boolean := false;
begin
  insert into public.departments (name) values ('Check Dept ' || gen_random_uuid()) returning id into dept;
  insert into auth.users (id, email) values
    (emp_user, 'check-emp@example.test'),
    (hr_user, 'check-hr@example.test'),
    (bad_user, 'check-bad@example.test');
  insert into public.app_users (id, email, role) values (hr_user, 'check-hr@example.test', 'hr');

  -- One new employee login + one linked HR login in a single call.
  out := public.fn_register_employees(jsonb_build_array(
    jsonb_build_object('user_id', emp_user, 'full_name', 'Check Emp', 'email', 'Check-Emp@Example.test',
      'department_id', dept, 'join_date', '2026-01-05', 'basic', 50000),
    jsonb_build_object('user_id', hr_user, 'link', true, 'full_name', 'Check HR', 'email', 'check-hr@example.test',
      'department_id', dept, 'join_date', '2026-01-05', 'status', 'active', 'basic', 80000)
  ), null);

  if jsonb_array_length(out) <> 2 or out->0->>'employee_code' !~ '^EMP-\d{4,}$' then
    raise exception 'FAIL: register result %', out;
  end if;
  emp_id := (out->0->>'id')::uuid;

  if not exists (
    select 1 from public.app_users
    where id = emp_user and role = 'employee' and must_change_password and employee_id = emp_id
  ) then
    raise exception 'FAIL: employee login row';
  end if;
  if (select email from public.employees where id = emp_id) <> 'check-emp@example.test' then
    raise exception 'FAIL: employee email stored lower-case';
  end if;
  if (select gross from public.salary_structures where employee_id = emp_id and effective_from = '2026-01-05') <> 75000 then
    raise exception 'FAIL: initial salary (gross 1.5 x basic)';
  end if;
  if not exists (
    select 1 from public.app_users
    where id = hr_user and role = 'hr' and not must_change_password and employee_id = (out->1->>'id')::uuid
  ) then
    raise exception 'FAIL: HR login linked without changing role or password flag';
  end if;

  -- All-or-nothing: second row has a duplicate email, so the first row is not kept either.
  select count(*) into employees_before from public.employees;
  begin
    perform public.fn_register_employees(jsonb_build_array(
      jsonb_build_object('user_id', bad_user, 'full_name', 'Fine Row', 'email', 'fine@example.test',
        'department_id', dept, 'join_date', '2026-01-05', 'basic', 1000),
      jsonb_build_object('user_id', gen_random_uuid(), 'full_name', 'Dup Row', 'email', 'check-emp@example.test',
        'department_id', dept, 'join_date', '2026-01-05', 'basic', 1000)
    ), null);
    failed := true;
  exception when unique_violation or foreign_key_violation then
    null;
  end;
  if failed then
    raise exception 'FAIL: duplicate email accepted';
  end if;
  if (select count(*) from public.employees) <> employees_before then
    raise exception 'FAIL: partial import kept rows';
  end if;

  -- Linking a login that already has an employee record is refused.
  begin
    perform public.fn_register_employees(jsonb_build_array(
      jsonb_build_object('user_id', hr_user, 'link', true, 'full_name', 'Again', 'email', 'again@example.test',
        'department_id', dept, 'join_date', '2026-01-05', 'basic', 1000)
    ), null);
    failed := true;
  exception when others then
    if sqlerrm not in ('login_not_linkable') and sqlstate <> '23505' then
      raise exception 'FAIL: relink raised %', sqlerrm;
    end if;
  end;
  if failed then
    raise exception 'FAIL: relinked an already linked login';
  end if;

  -- The code generator skips a code that a CSV import already used.
  next_code := public.fn_next_employee_code();
  taken_code := 'EMP-' || lpad((substr(next_code, 5)::bigint + 1)::text, 4, '0');
  insert into public.employees (employee_code, full_name, email, join_date, department_id)
  values (taken_code, 'Taken Code', 'taken@example.test', '2026-01-05', dept);
  next_code := public.fn_next_employee_code();
  if next_code = taken_code or exists (select 1 from public.employees e where e.employee_code = next_code) then
    raise exception 'FAIL: generator returned a taken code %', next_code;
  end if;

  if pg_catalog.has_function_privilege('anon', 'public.fn_register_employees(jsonb,uuid)', 'EXECUTE') then
    raise exception 'FAIL: anon can execute fn_register_employees';
  end if;
end
$$;

rollback;

select 'ALL EMPLOYEE CHECKS PASSED' as result;
