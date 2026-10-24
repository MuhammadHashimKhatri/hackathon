-- =============================================================================
-- HCM Lite — schema self-checks for 001_schema.sql
-- Safe on any database: everything runs in one transaction that is ROLLED BACK,
-- so no rows are left behind. Any failed check raises "FAIL: ..." and stops.
-- Expected output on success: one row "ALL SCHEMA CHECKS PASSED".
--
-- Test data (September 2026, Sat/Sun weekend, holiday Mon 14 Sep):
--   A (dept 1) joined 1 Sep: present 1st, late 2nd, no check-out 3rd, nothing 4th,
--     present Sat 5th, approved leave 7th–8th, half day 9th.
--   B (dept 2) joined Thu 10 Sep, exited Fri 18 Sep: no attendance.
-- =============================================================================

begin;

create function pg_temp.assert_ok(ok boolean, what text) returns void language plpgsql as $$
begin
  if ok is not true then
    raise exception 'FAIL: %', what using errcode = 'HCFAL';
  end if;
end
$$;

create function pg_temp.expect_error(stmt text, expected_state text, what text) returns void language plpgsql as $$
begin
  begin
    execute stmt;
  exception when others then
    if sqlstate = expected_state then
      return;
    end if;
    raise exception 'FAIL: % (expected SQLSTATE %, got %: %)', what, expected_state, sqlstate, sqlerrm using errcode = 'HCFAL';
  end;
  raise exception 'FAIL: % (statement succeeded but should have failed)', what using errcode = 'HCFAL';
end
$$;

do $$
declare
  d1 uuid; d2 uuid; casual uuid;
  a uuid; b uuid; a_code text;
  run uuid; slip uuid; audit uuid;
  today date := public.fn_company_today();
  future_monday date;
  s_hra numeric; s_medical numeric; s_gross numeric;
  health jsonb;
begin
  -- ---------------------------------------------------------------- setup
  insert into public.company_settings (id, company_name, timezone, weekend_days)
    values (1, 'Check Co', 'Asia/Karachi', '{0,6}')
    on conflict (id) do update set timezone = excluded.timezone, weekend_days = excluded.weekend_days;
  insert into public.holidays (date, name) values ('2026-09-14', 'Check holiday');
  insert into public.departments (name) values ('Check Dept 1') returning id into d1;
  insert into public.departments (name) values ('Check Dept 2') returning id into d2;
  insert into public.leave_types (code, name, yearly_quota, is_paid)
    values ('casual', 'Casual', 10, true)
    on conflict (code) do update set name = excluded.name
    returning id into casual;

  insert into public.employees (full_name, email, department_id, join_date, status)
    values ('Check A', 'check-a@example.test', d1, '2026-09-01', 'active')
    returning id, employee_code into a, a_code;
  insert into public.employees (full_name, email, department_id, join_date, exit_date, status)
    values ('Check B', 'check-b@example.test', d2, '2026-09-10', '2026-09-18', 'exited')
    returning id into b;

  insert into public.attendance (employee_id, work_date, check_in_at, check_out_at, status) values
    (a, '2026-09-01', '2026-09-01 08:55+05', '2026-09-01 17:00+05', 'present'),
    (a, '2026-09-02', '2026-09-02 09:20+05', '2026-09-02 17:00+05', 'late'),
    (a, '2026-09-03', '2026-09-03 09:00+05', null,                  'present'),
    (a, '2026-09-05', '2026-09-05 10:00+05', '2026-09-05 16:00+05', 'present'),
    (a, '2026-09-09', '2026-09-09 09:00+05', '2026-09-09 12:00+05', 'half_day');
  insert into public.leave_requests (employee_id, leave_type_id, start_date, end_date, days, status)
    values (a, casual, '2026-09-07', '2026-09-08', 2, 'approved');

  -- ---------------------------------------------------------------- codes and generated columns
  perform pg_temp.assert_ok(a_code ~ '^EMP-[0-9]{4,}$', 'employee_code looks like EMP-0001, got ' || a_code);

  insert into public.salary_structures (employee_id, basic, effective_from)
    values (a, 50000, '2026-09-01')
    returning hra, medical, gross into s_hra, s_medical, s_gross;
  perform pg_temp.assert_ok(s_hra = 20000 and s_medical = 5000 and s_gross = 75000,
    'salary 50,000 basic gives HRA 20,000, medical 5,000, gross 75,000');

  -- ---------------------------------------------------------------- working days
  perform pg_temp.assert_ok(public.fn_working_days('2026-10-01', '2026-10-31') = 22, 'October 2026 has 22 working days');
  perform pg_temp.assert_ok(public.fn_working_days('2026-09-01', '2026-09-30') = 21, 'September 2026 has 21 working days (22 minus the holiday)');
  perform pg_temp.assert_ok(public.fn_working_days('2026-09-30', '2026-09-01') = 0, 'reversed range has 0 working days');
  perform pg_temp.assert_ok(not public.fn_is_working_day('2026-09-14'), 'holiday is not a working day');
  perform pg_temp.assert_ok(not public.fn_is_working_day('2026-09-05'), 'Saturday is not a working day');
  perform pg_temp.assert_ok(public.fn_is_working_day('2026-09-15'), 'ordinary Tuesday is a working day');

  -- ---------------------------------------------------------------- derived attendance (Spec §6)
  create temp table ad on commit drop as
    select * from public.fn_attendance_days('2026-09-01', '2026-09-30');

  perform pg_temp.assert_ok((select count(*) from ad where employee_id = a) = 22,
    'A has 21 working-day rows + 1 Saturday row in September');
  perform pg_temp.assert_ok((select effective_status from ad where employee_id = a and work_date = '2026-09-01') = 'present', '1 Sep present');
  perform pg_temp.assert_ok((select effective_status from ad where employee_id = a and work_date = '2026-09-02') = 'late', '2 Sep late');
  perform pg_temp.assert_ok((select effective_status from ad where employee_id = a and work_date = '2026-09-03') = 'missing_checkout', '3 Sep missing check-out');
  perform pg_temp.assert_ok((select effective_status from ad where employee_id = a and work_date = '2026-09-04') = 'absent', '4 Sep absent');
  perform pg_temp.assert_ok((select effective_status = 'present' and not is_working_day from ad where employee_id = a and work_date = '2026-09-05'),
    'Saturday check-in is kept and marked as a non-working day');
  perform pg_temp.assert_ok((select count(*) from ad where employee_id = a and effective_status = 'on_leave' and leave_type_code = 'casual') = 2, '7–8 Sep on casual leave');
  perform pg_temp.assert_ok((select effective_status from ad where employee_id = a and work_date = '2026-09-09') = 'half_day', '9 Sep half day');
  perform pg_temp.assert_ok(not exists (select 1 from ad where work_date = '2026-09-14'), 'no rows on the holiday');
  perform pg_temp.assert_ok((select count(*) from ad where employee_id = a and effective_status = 'absent') = 15, 'A absent on the other 15 working days');

  perform pg_temp.assert_ok((select count(*) from ad where employee_id = b) = 6, 'B has rows for 10–18 Sep only (6 working days, exit day included)');
  perform pg_temp.assert_ok(not exists (select 1 from ad where employee_id = b and (work_date < '2026-09-10' or work_date > '2026-09-18')),
    'B has no rows before joining or after exiting');

  perform pg_temp.assert_ok(
    (select count(*) = 6 and bool_and(employee_id = b) from public.fn_attendance_days('2026-09-01', '2026-09-30', d2)),
    'department filter returns only that department');

  -- Today counts as absent only after the day ends; future approved leave is visible.
  perform pg_temp.assert_ok(not exists (
      select 1 from public.fn_attendance_days(today, today + 60) where employee_id = a and effective_status = 'absent'),
    'today and future days are never absent');
  future_monday := today + 7 + ((8 - extract(isodow from today + 7)::int) % 7);
  insert into public.leave_requests (employee_id, leave_type_id, start_date, end_date, days, status)
    values (a, casual, future_monday, future_monday, 1, 'approved');
  perform pg_temp.assert_ok(
    (select effective_status from public.fn_attendance_days(future_monday, future_monday) where employee_id = a) = 'on_leave',
    'approved future leave shows as on_leave');

  -- ---------------------------------------------------------------- constraints
  perform pg_temp.expect_error(
    format($q$insert into public.attendance (employee_id, work_date, check_in_at, status) values (%L, '2026-09-01', now(), 'present')$q$, a),
    '23505', 'second check-in on the same day is rejected');
  perform pg_temp.expect_error(
    format($q$insert into public.leave_requests (employee_id, leave_type_id, start_date, end_date, days) values (%L, %L, '2026-09-08', '2026-09-09', 2)$q$, a, casual),
    '23P01', 'overlapping pending leave is rejected');
  insert into public.leave_requests (employee_id, leave_type_id, start_date, end_date, days, status)
    values (a, casual, '2026-09-08', '2026-09-08', 1, 'rejected');
  perform pg_temp.expect_error(
    format($q$insert into public.leave_requests (employee_id, leave_type_id, start_date, end_date, days) values (%L, %L, '2026-12-31', '2027-01-01', 1)$q$, a, casual),
    '23514', 'leave spanning two calendar years is rejected');
  perform pg_temp.expect_error(
    format($q$insert into public.leave_requests (employee_id, leave_type_id, start_date, end_date, days) values (%L, %L, '2026-09-22', '2026-09-21', 1)$q$, a, casual),
    '23514', 'leave ending before it starts is rejected');
  perform pg_temp.expect_error(
    $q$insert into public.payroll_runs (month) values ('2026-09-15')$q$,
    '23514', 'payroll month must be the first day of a month');
  perform pg_temp.expect_error(
    format($q$insert into public.salary_structures (employee_id, basic, effective_from) values (%L, 0, '2026-10-01')$q$, a),
    '23514', 'basic salary must be greater than 0');

  -- ---------------------------------------------------------------- payroll lock
  insert into public.payroll_runs (month) values ('2026-09-01') returning id into run;
  insert into public.payslips (run_id, employee_id, working_days, eligible_days, basic, hra, medical, gross, prorated_gross, per_day, net)
    values (run, a, 21, 21, 50000, 20000, 5000, 75000, 75000, 3571.43, 73750) returning id into slip;
  update public.payslips set deduction = 0 where id = slip; -- allowed while draft
  update public.payroll_runs set status = 'finalized', finalized_at = now() where id = run;

  perform pg_temp.expect_error(format('update public.payslips set net = 1 where id = %L', slip), 'P0001', 'finalized payslip cannot be edited');
  perform pg_temp.expect_error(format('delete from public.payslips where id = %L', slip), 'P0001', 'finalized payslip cannot be deleted');
  perform pg_temp.expect_error(
    format($q$insert into public.payslips (run_id, employee_id, working_days, eligible_days, basic, hra, medical, gross, prorated_gross, per_day, net) values (%L, %L, 21, 6, 1, 1, 1, 1, 1, 1, 1)$q$, run, b),
    'P0001', 'no payslips can be added to a finalized run');
  perform pg_temp.expect_error(format('update public.payroll_runs set total_net = 0 where id = %L', run), 'P0001', 'finalized run cannot be edited');
  perform pg_temp.expect_error(format('delete from public.payroll_runs where id = %L', run), 'P0001', 'finalized run cannot be deleted');

  -- ---------------------------------------------------------------- audit log is append-only
  insert into public.audit_logs (action, entity, entity_id) values ('create', 'check', 'x') returning id into audit;
  perform pg_temp.expect_error(format($q$update public.audit_logs set action = 'tampered' where id = %L$q$, audit), 'P0001', 'audit entry cannot be updated');
  perform pg_temp.expect_error(format('delete from public.audit_logs where id = %L', audit), 'P0001', 'audit entry cannot be deleted');

  -- ---------------------------------------------------------------- lock-down
  health := public.fn_schema_health();
  perform pg_temp.assert_ok((select bool_and((t->>'exists')::boolean and (t->>'rls')::boolean) from jsonb_array_elements(health->'tables') t),
    'every app table exists with RLS enabled');
  perform pg_temp.assert_ok((select not bool_or((t->>'anon_access')::boolean) from jsonb_array_elements(health->'tables') t),
    'anon/authenticated have no table privileges');
  perform pg_temp.assert_ok(jsonb_array_length(health->'anon_can_execute') = 0,
    'anon/authenticated cannot execute any fn_/tg_ function: ' || (health->'anon_can_execute')::text);
  perform pg_temp.assert_ok((health->'triggers'->>'trg_touch_updated_at')::int = 12, 'updated_at trigger on 12 tables');
  perform pg_temp.assert_ok((health->'triggers'->>'trg_audit_logs_append_only')::int = 1
                    and (health->'triggers'->>'trg_payroll_runs_lock')::int = 1
                    and (health->'triggers'->>'trg_payslips_lock')::int = 1, 'lock triggers exist');
end
$$;

rollback;

select 'ALL SCHEMA CHECKS PASSED' as result;
