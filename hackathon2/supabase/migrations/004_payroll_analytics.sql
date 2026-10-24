-- =============================================================================
-- HCM Lite — 004_payroll_analytics.sql (run after 003_employees.sql)
-- Spec: docs/HCM_SPEC.md §6 Payroll + Metrics, §7 Dashboards
--
-- Paste into the Supabase SQL Editor and run. Safe to run more than once.
-- Functions only: no table changes. Every number is computed here (Spec §7).
-- =============================================================================

begin;

-- Per employee employed in the month: the counts payroll needs (Spec §6 Payroll).
create or replace function public.fn_payroll_counts(p_month date)
returns table (
  employee_id   uuid,
  working_days  int,
  eligible_days int,
  absent_days   int,
  half_days     int,
  late_count    int,
  unpaid_days   int
)
language sql
stable
security definer
set search_path = ''
as $$
  with m as (
    select date_trunc('month', p_month)::date as m_from,
           (date_trunc('month', p_month) + interval '1 month - 1 day')::date as m_to
  ),
  emps as (
    select e.id,
           greatest(e.join_date, m.m_from) as f,
           least(coalesce(e.exit_date, m.m_to), m.m_to) as t
    from public.employees e, m
    where e.join_date <= m.m_to
      and (e.exit_date is null or e.exit_date >= m.m_from)
  ),
  d as (
    select a.* from m, public.fn_attendance_days(m.m_from, m.m_to) a
  )
  select
    emps.id,
    public.fn_working_days(m.m_from, m.m_to),
    public.fn_working_days(emps.f, emps.t),
    (count(*) filter (where d.effective_status = 'absent'))::int,
    (count(*) filter (where d.effective_status = 'half_day'))::int,
    (count(*) filter (where d.effective_status = 'late'))::int,
    (count(*) filter (where d.effective_status = 'on_leave' and d.leave_type_code = 'unpaid' and d.is_working_day))::int
  from emps
  cross join m
  left join d on d.employee_id = emps.id
  group by emps.id, m.m_from, m.m_to, emps.f, emps.t
$$;

-- One JSON object with every dashboard number for [p_from, p_to] and an optional
-- department. The Admin and HR dashboards and the AI summary all read this.
create or replace function public.fn_dashboard(p_from date, p_to date, p_dept uuid default null)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_today date := public.fn_company_today();
  v_year_start date := date_trunc('year', p_to)::date;
  v_head_end int;
  v_head_start int;
  v_exits int;
  result jsonb;
begin
  -- Headcount = active/probation employees employed on the date (Spec §6 Metrics).
  select count(*) into v_head_end from public.employees e
   where e.status in ('active', 'probation') and e.join_date <= p_to
     and (e.exit_date is null or e.exit_date > p_to)
     and (p_dept is null or e.department_id = p_dept);
  select count(*) into v_head_start from public.employees e
   where e.join_date <= p_from and (e.exit_date is null or e.exit_date > p_from)
     and (p_dept is null or e.department_id = p_dept);
  select count(*) into v_exits from public.employees e
   where e.exit_date between p_from and p_to
     and (p_dept is null or e.department_id = p_dept);

  with d as (
    select a.*, e.full_name, e.employee_code
    from public.fn_attendance_days(p_from, p_to, p_dept) a
    join public.employees e on e.id = a.employee_id
  ),
  totals as (
    select
      count(*) filter (where effective_status = 'present') as present,
      count(*) filter (where effective_status = 'late') as late,
      count(*) filter (where effective_status = 'half_day') as half_day,
      count(*) filter (where effective_status = 'missing_checkout') as missing_checkout,
      count(*) filter (where effective_status = 'absent') as absent,
      count(*) filter (where effective_status = 'on_leave') as on_leave,
      count(*) as records,
      count(*) filter (where is_working_day) as expected
    from d
  ),
  today as (
    select
      count(*) filter (where effective_status in ('present', 'late', 'half_day', 'missing_checkout')) as present,
      count(*) filter (where effective_status = 'late') as late,
      count(*) filter (where effective_status = 'on_leave') as on_leave
    from public.fn_attendance_days(v_today, v_today, p_dept)
  )
  select jsonb_build_object(
    'filters', jsonb_build_object('from', p_from, 'to', p_to, 'department', p_dept, 'today', v_today),
    'headcount', v_head_end,
    'exits', v_exits,
    'attrition_pct', case when (v_head_start + v_head_end) = 0 then 0
                          else round(v_exits * 100.0 / ((v_head_start + v_head_end) / 2.0), 1) end,
    'today', (select jsonb_build_object('present', t.present, 'late', t.late, 'on_leave', t.on_leave) from today t),
    'pending_leave', (select count(*) from public.leave_requests lr join public.employees e on e.id = lr.employee_id
                       where lr.status = 'pending' and (p_dept is null or e.department_id = p_dept)),
    'pending_corrections', (select count(*) from public.attendance_corrections c join public.employees e on e.id = c.employee_id
                             where c.status = 'pending' and (p_dept is null or e.department_id = p_dept)),
    'attendance', (
      select jsonb_build_object(
        'present', t.present, 'late', t.late, 'half_day', t.half_day, 'missing_checkout', t.missing_checkout,
        'absent', t.absent, 'on_leave', t.on_leave, 'records', t.records,
        'rate_pct', case when t.records - t.on_leave = 0 then null
                         else round((t.present + t.late + t.missing_checkout + 0.5 * t.half_day) * 100.0 / (t.records - t.on_leave), 1) end,
        'late_pct', case when t.present + t.late = 0 then null else round(t.late * 100.0 / (t.present + t.late), 1) end,
        'absenteeism_pct', case when t.expected = 0 then null else round(t.absent * 100.0 / t.expected, 1) end
      ) from totals t
    ),
    'trend', coalesce((
      select jsonb_agg(x order by x.date) from (
        select work_date as date,
               count(*) filter (where effective_status in ('present', 'late', 'half_day', 'missing_checkout')) as present,
               count(*) filter (where effective_status = 'late') as late,
               count(*) filter (where effective_status = 'absent') as absent,
               case when count(*) - count(*) filter (where effective_status = 'on_leave') = 0 then null
                    else round((count(*) filter (where effective_status in ('present', 'late', 'missing_checkout'))
                                + 0.5 * count(*) filter (where effective_status = 'half_day')) * 100.0
                               / (count(*) - count(*) filter (where effective_status = 'on_leave')), 1) end as rate_pct
        from d group by work_date
      ) x), '[]'::jsonb),
    'absenteeism_by_dept', coalesce((
      select jsonb_agg(x order by x.department) from (
        select coalesce(dep.name, 'No department') as department,
               count(*) filter (where d.effective_status = 'absent') as absent,
               count(*) filter (where d.is_working_day) as expected,
               case when count(*) filter (where d.is_working_day) = 0 then 0
                    else round(count(*) filter (where d.effective_status = 'absent') * 100.0
                               / count(*) filter (where d.is_working_day), 1) end as pct
        from d left join public.departments dep on dep.id = d.department_id
        group by dep.name
      ) x), '[]'::jsonb),
    'top_late', coalesce((
      select jsonb_agg(x order by x.late desc, x.name) from (
        select d.employee_id, d.full_name as name, d.employee_code as code, count(*) as late
        from d where d.effective_status = 'late'
        group by d.employee_id, d.full_name, d.employee_code
        order by count(*) desc, d.full_name
        limit 5
      ) x), '[]'::jsonb),
    'leave_by_type', coalesce((
      select jsonb_agg(x order by x.name) from (
        select lt.code, lt.name, lt.yearly_quota as quota,
               coalesce((select count(*) from d where d.effective_status = 'on_leave' and d.leave_type_code = lt.code), 0) as days_in_range,
               coalesce((select sum(lr.days) from public.leave_requests lr join public.employees e on e.id = lr.employee_id
                          where lr.leave_type_id = lt.id and lr.status = 'approved'
                            and lr.start_date >= v_year_start and lr.start_date <= p_to
                            and (p_dept is null or e.department_id = p_dept)), 0) as approved_ytd,
               case when lt.yearly_quota is null or v_head_end = 0 then null
                    else round(coalesce((select sum(lr.days) from public.leave_requests lr join public.employees e on e.id = lr.employee_id
                          where lr.leave_type_id = lt.id and lr.status = 'approved'
                            and lr.start_date >= v_year_start and lr.start_date <= p_to
                            and (p_dept is null or e.department_id = p_dept)), 0) * 100.0 / (lt.yearly_quota * v_head_end), 1) end as utilization_pct
        from public.leave_types lt
      ) x), '[]'::jsonb),
    'by_department', coalesce((
      select jsonb_agg(x order by x.department) from (
        select coalesce(dep.name, 'No department') as department, count(*) as headcount
        from public.employees e left join public.departments dep on dep.id = e.department_id
        where e.status in ('active', 'probation') and e.join_date <= p_to and (e.exit_date is null or e.exit_date > p_to)
          and (p_dept is null or e.department_id = p_dept)
        group by dep.name
      ) x), '[]'::jsonb),
    'gender', coalesce((
      select jsonb_agg(x order by x.gender) from (
        select coalesce(e.gender::text, 'not set') as gender, count(*) as count
        from public.employees e
        where e.status in ('active', 'probation') and e.join_date <= p_to and (e.exit_date is null or e.exit_date > p_to)
          and (p_dept is null or e.department_id = p_dept)
        group by e.gender
      ) x), '[]'::jsonb),
    'tenure', coalesce((
      select jsonb_agg(x order by x.sort) from (
        select case when age(p_to, e.join_date) < interval '1 year' then 'Under 1 year'
                    when age(p_to, e.join_date) < interval '3 years' then '1–3 years'
                    when age(p_to, e.join_date) < interval '5 years' then '3–5 years'
                    else '5+ years' end as bucket,
               min(case when age(p_to, e.join_date) < interval '1 year' then 1
                        when age(p_to, e.join_date) < interval '3 years' then 2
                        when age(p_to, e.join_date) < interval '5 years' then 3 else 4 end) as sort,
               count(*) as count
        from public.employees e
        where e.status in ('active', 'probation') and e.join_date <= p_to and (e.exit_date is null or e.exit_date > p_to)
          and (p_dept is null or e.department_id = p_dept)
        group by 1
      ) x), '[]'::jsonb),
    'payroll', jsonb_build_object(
      'by_month', coalesce((
        select jsonb_agg(x order by x.month) from (
          select r.month, r.status, sum(p.prorated_gross) as gross, sum(p.net) as net, count(*) as employees
          from public.payroll_runs r join public.payslips p on p.run_id = r.id
          join public.employees e on e.id = p.employee_id
          where r.month between date_trunc('month', p_from)::date and p_to
            and (p_dept is null or e.department_id = p_dept)
          group by r.month, r.status
        ) x), '[]'::jsonb),
      'by_dept', coalesce((
        select jsonb_agg(x order by x.department) from (
          select coalesce(dep.name, 'No department') as department, sum(p.prorated_gross) as gross, sum(p.net) as net
          from public.payroll_runs r join public.payslips p on p.run_id = r.id
          join public.employees e on e.id = p.employee_id
          left join public.departments dep on dep.id = e.department_id
          where r.month between date_trunc('month', p_from)::date and p_to
            and (p_dept is null or e.department_id = p_dept)
          group by dep.name
        ) x), '[]'::jsonb),
      'cost_gross', (select coalesce(sum(p.prorated_gross), 0) from public.payroll_runs r join public.payslips p on p.run_id = r.id
                      join public.employees e on e.id = p.employee_id
                      where r.month between date_trunc('month', p_from)::date and p_to
                        and (p_dept is null or e.department_id = p_dept)),
      'cost_net', (select coalesce(sum(p.net), 0) from public.payroll_runs r join public.payslips p on p.run_id = r.id
                    join public.employees e on e.id = p.employee_id
                    where r.month between date_trunc('month', p_from)::date and p_to
                      and (p_dept is null or e.department_id = p_dept)),
      -- Current salary = latest salary structure of each employee on the end date.
      'avg_salary', (select round(avg(s.gross), 2) from public.employees e
                      join lateral (select ss.gross from public.salary_structures ss where ss.employee_id = e.id
                                     and ss.effective_from <= p_to order by ss.effective_from desc limit 1) s on true
                      where e.status in ('active', 'probation') and e.join_date <= p_to and (e.exit_date is null or e.exit_date > p_to)
                        and (p_dept is null or e.department_id = p_dept)),
      'avg_by_dept', coalesce((
        select jsonb_agg(x order by x.department) from (
          select coalesce(dep.name, 'No department') as department, round(avg(s.gross), 2) as avg_gross, count(*) as employees
          from public.employees e
          left join public.departments dep on dep.id = e.department_id
          join lateral (select ss.gross from public.salary_structures ss where ss.employee_id = e.id
                         and ss.effective_from <= p_to order by ss.effective_from desc limit 1) s on true
          where e.status in ('active', 'probation') and e.join_date <= p_to and (e.exit_date is null or e.exit_date > p_to)
            and (p_dept is null or e.department_id = p_dept)
          group by dep.name
        ) x), '[]'::jsonb),
      'avg_by_designation', coalesce((
        select jsonb_agg(x order by x.designation) from (
          select coalesce(des.title, 'No designation') as designation, round(avg(s.gross), 2) as avg_gross, count(*) as employees
          from public.employees e
          left join public.designations des on des.id = e.designation_id
          join lateral (select ss.gross from public.salary_structures ss where ss.employee_id = e.id
                         and ss.effective_from <= p_to order by ss.effective_from desc limit 1) s on true
          where e.status in ('active', 'probation') and e.join_date <= p_to and (e.exit_date is null or e.exit_date > p_to)
            and (p_dept is null or e.department_id = p_dept)
          group by des.title
        ) x), '[]'::jsonb)
    )
  ) into result;
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
      and p.proname in ('fn_payroll_counts', 'fn_dashboard')
  loop
    execute format('revoke all on function %s from public, anon, authenticated', f);
    execute format('grant execute on function %s to service_role', f);
  end loop;
end
$$;

notify pgrst, 'reload schema';

commit;
