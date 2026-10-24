-- =============================================================================
-- HCM Lite — 001_schema.sql
-- Spec: docs/HCM_SPEC.md §5 (data model) and §6 (business rules).
-- Plan: docs/specs/02-database-schema.md
--
-- Paste into the Supabase SQL Editor and run. Safe to run more than once.
-- Creates no rows: the app starts empty and /setup creates the first data.
-- =============================================================================

begin;

-- -----------------------------------------------------------------------------
-- 1. Remove the earlier demo (profiles) objects
-- -----------------------------------------------------------------------------
drop trigger if exists on_auth_user_created on auth.users;
drop function if exists public.handle_new_user() cascade;
drop table if exists public.profiles cascade;
drop function if exists public.set_updated_at() cascade;

-- -----------------------------------------------------------------------------
-- 2. Extensions
-- -----------------------------------------------------------------------------
create schema if not exists extensions;
create extension if not exists btree_gist with schema extensions; -- leave overlap guard

-- -----------------------------------------------------------------------------
-- 3. Enums
-- -----------------------------------------------------------------------------
do $$ begin create type public.app_role as enum ('admin', 'hr', 'employee'); exception when duplicate_object then null; end $$;
do $$ begin create type public.gender as enum ('male', 'female', 'other'); exception when duplicate_object then null; end $$;
do $$ begin create type public.employee_status as enum ('probation', 'active', 'exited'); exception when duplicate_object then null; end $$;
do $$ begin create type public.attendance_status as enum ('present', 'late', 'half_day'); exception when duplicate_object then null; end $$;
do $$ begin create type public.attendance_source as enum ('web', 'camera', 'correction'); exception when duplicate_object then null; end $$;
do $$ begin create type public.request_status as enum ('pending', 'approved', 'rejected'); exception when duplicate_object then null; end $$;
do $$ begin create type public.leave_status as enum ('pending', 'approved', 'rejected', 'cancelled'); exception when duplicate_object then null; end $$;
do $$ begin create type public.leave_source as enum ('form', 'ai'); exception when duplicate_object then null; end $$;
do $$ begin create type public.payroll_status as enum ('draft', 'finalized'); exception when duplicate_object then null; end $$;
do $$ begin create type public.ai_feature as enum ('chat', 'summary', 'smart_leave'); exception when duplicate_object then null; end $$;

-- -----------------------------------------------------------------------------
-- 4. Employee codes: EMP-0001, EMP-0002, … (widens past EMP-9999 instead of truncating)
-- -----------------------------------------------------------------------------
create sequence if not exists public.employee_code_seq;

create or replace function public.fn_next_employee_code()
returns text
language plpgsql
volatile
set search_path = ''
as $$
declare
  n bigint := nextval('public.employee_code_seq');
begin
  return 'EMP-' || lpad(n::text, greatest(4, length(n::text)), '0');
end
$$;

-- -----------------------------------------------------------------------------
-- 5. Tables (FK order)
-- -----------------------------------------------------------------------------

-- Single row (id = 1). Created by /setup; functions fall back to these defaults until then.
create table if not exists public.company_settings (
  id                   int primary key default 1 check (id = 1),
  company_name         text,
  timezone             text not null default 'Asia/Karachi',
  office_start         time not null default '09:00',
  grace_minutes        int not null default 15 check (grace_minutes between 0 and 240),
  half_day_hours       numeric(4,2) not null default 5 check (half_day_hours > 0 and half_day_hours <= 24),
  weekend_days         int[] not null default '{0,6}' check (weekend_days <@ '{0,1,2,3,4,5,6}'::int[]),
  office_lat           numeric(9,6) check (office_lat between -90 and 90),
  office_lng           numeric(9,6) check (office_lng between -180 and 180),
  office_radius_m      int not null default 150 check (office_radius_m > 0),
  max_gps_accuracy_m   int not null default 100 check (max_gps_accuracy_m > 0),
  late_penalty_enabled boolean not null default false,
  setup_completed      boolean not null default false,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);

create table if not exists public.departments (
  id         uuid primary key default gen_random_uuid(),
  name       text not null check (length(trim(name)) > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists departments_name_key on public.departments (lower(name));

create table if not exists public.designations (
  id            uuid primary key default gen_random_uuid(),
  title         text not null check (length(trim(title)) > 0),
  department_id uuid references public.departments (id) on delete restrict,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  constraint designations_title_department_key unique nulls not distinct (title, department_id)
);

create table if not exists public.leave_types (
  id           uuid primary key default gen_random_uuid(),
  code         text not null unique check (code in ('annual', 'sick', 'casual', 'unpaid')),
  name         text not null,
  yearly_quota int check (yearly_quota >= 0), -- null = unlimited
  is_paid      boolean not null default true,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create table if not exists public.holidays (
  id         uuid primary key default gen_random_uuid(),
  date       date not null unique,
  name       text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.employees (
  id              uuid primary key default gen_random_uuid(),
  employee_code   text not null unique default public.fn_next_employee_code(),
  user_id         uuid unique references auth.users (id) on delete set null,
  full_name       text not null check (length(trim(full_name)) > 0),
  email           text not null,
  phone           text,
  address         text,
  gender          public.gender,
  date_of_birth   date,
  department_id   uuid references public.departments (id) on delete restrict,
  designation_id  uuid references public.designations (id) on delete restrict,
  join_date       date not null,
  exit_date       date,
  status          public.employee_status not null default 'probation',
  face_descriptor jsonb,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  constraint employees_exit_after_join check (exit_date is null or exit_date >= join_date),
  constraint employees_exited_has_date check (status <> 'exited' or exit_date is not null),
  constraint employees_dob_before_join check (date_of_birth is null or date_of_birth < join_date)
);
create unique index if not exists employees_email_key on public.employees (lower(email));

-- One row per login. Created after employees so the two links need no circular FK.
create table if not exists public.app_users (
  id                   uuid primary key references auth.users (id) on delete cascade,
  email                text not null,
  role                 public.app_role not null,
  is_active            boolean not null default true,
  must_change_password boolean not null default false,
  employee_id          uuid unique references public.employees (id) on delete set null,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);
create unique index if not exists app_users_email_key on public.app_users (lower(email));

create table if not exists public.salary_structures (
  id             uuid primary key default gen_random_uuid(),
  employee_id    uuid not null references public.employees (id) on delete restrict,
  basic          numeric(12,2) not null check (basic > 0),
  hra            numeric(12,2) generated always as (round(basic * 0.40, 2)) stored,
  medical        numeric(12,2) generated always as (round(basic * 0.10, 2)) stored,
  gross          numeric(12,2) generated always as (basic + round(basic * 0.40, 2) + round(basic * 0.10, 2)) stored,
  effective_from date not null,
  created_by     uuid references public.app_users (id) on delete set null,
  created_at     timestamptz not null default now(),
  constraint salary_structures_employee_effective_key unique (employee_id, effective_from)
);

create table if not exists public.attendance (
  id           uuid primary key default gen_random_uuid(),
  employee_id  uuid not null references public.employees (id) on delete restrict,
  work_date    date not null,
  check_in_at  timestamptz not null,
  check_out_at timestamptz,
  status       public.attendance_status not null,
  source       public.attendance_source not null default 'web',
  lat          numeric(9,6) check (lat between -90 and 90),
  lng          numeric(9,6) check (lng between -180 and 180),
  accuracy_m   numeric(8,2) check (accuracy_m >= 0),
  distance_m   numeric(10,2) check (distance_m >= 0),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  constraint attendance_employee_day_key unique (employee_id, work_date),
  constraint attendance_checkout_after_checkin check (check_out_at is null or check_out_at > check_in_at)
);

create table if not exists public.attendance_corrections (
  id                  uuid primary key default gen_random_uuid(),
  employee_id         uuid not null references public.employees (id) on delete restrict,
  work_date           date not null,
  requested_check_in  timestamptz,
  requested_check_out timestamptz,
  reason              text not null check (length(trim(reason)) > 0),
  status              public.request_status not null default 'pending',
  reviewed_by         uuid references public.app_users (id) on delete set null,
  review_comment      text,
  reviewed_at         timestamptz,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  constraint corrections_has_time check (requested_check_in is not null or requested_check_out is not null),
  constraint corrections_out_after_in check (
    requested_check_in is null or requested_check_out is null or requested_check_out > requested_check_in
  )
);
create unique index if not exists attendance_corrections_one_pending
  on public.attendance_corrections (employee_id, work_date) where status = 'pending';

create table if not exists public.leave_requests (
  id             uuid primary key default gen_random_uuid(),
  employee_id    uuid not null references public.employees (id) on delete restrict,
  leave_type_id  uuid not null references public.leave_types (id) on delete restrict,
  start_date     date not null,
  end_date       date not null,
  days           numeric(4,1) not null check (days > 0),
  reason         text,
  status         public.leave_status not null default 'pending',
  source         public.leave_source not null default 'form',
  reviewed_by    uuid references public.app_users (id) on delete set null,
  review_comment text,
  reviewed_at    timestamptz,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  constraint leave_requests_end_after_start check (end_date >= start_date),
  constraint leave_requests_same_year check (extract(year from start_date) = extract(year from end_date)),
  -- Safety net under the leave service: no overlapping pending/approved requests (SQLSTATE 23P01).
  constraint leave_requests_no_overlap exclude using gist (
    employee_id with =,
    daterange(start_date, end_date, '[]') with &&
  ) where (status in ('pending', 'approved'))
);

create table if not exists public.payroll_runs (
  id           uuid primary key default gen_random_uuid(),
  month        date not null unique check (month = date_trunc('month', month)::date),
  status       public.payroll_status not null default 'draft',
  created_by   uuid references public.app_users (id) on delete set null,
  finalized_by uuid references public.app_users (id) on delete set null,
  finalized_at timestamptz,
  total_gross  numeric(14,2) not null default 0,
  total_net    numeric(14,2) not null default 0,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  constraint payroll_runs_finalized_has_time check ((status = 'finalized') = (finalized_at is not null))
);

create table if not exists public.payslips (
  id                uuid primary key default gen_random_uuid(),
  run_id            uuid not null references public.payroll_runs (id) on delete cascade,
  employee_id       uuid not null references public.employees (id) on delete restrict,
  working_days      int not null check (working_days >= 0),
  eligible_days     int not null check (eligible_days >= 0),
  absent_days       numeric(5,1) not null default 0 check (absent_days >= 0),
  unpaid_leave_days numeric(5,1) not null default 0 check (unpaid_leave_days >= 0),
  half_days         int not null default 0 check (half_days >= 0),
  late_count        int not null default 0 check (late_count >= 0),
  basic             numeric(12,2) not null,
  hra               numeric(12,2) not null,
  medical           numeric(12,2) not null,
  gross             numeric(12,2) not null,
  prorated_gross    numeric(12,2) not null,
  per_day           numeric(12,2) not null,
  deduction         numeric(12,2) not null default 0,
  monthly_tax       numeric(12,2) not null default 0,
  net               numeric(12,2) not null check (net >= 0),
  created_at        timestamptz not null default now(),
  constraint payslips_run_employee_key unique (run_id, employee_id)
);

create table if not exists public.announcements (
  id         uuid primary key default gen_random_uuid(),
  title      text not null check (length(trim(title)) > 0),
  body       text not null,
  author_id  uuid references public.app_users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.notifications (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.app_users (id) on delete cascade,
  type       text not null,
  title      text not null,
  body       text,
  link       text,
  read_at    timestamptz,
  created_at timestamptz not null default now()
);

-- Append-only (trigger below). No FKs on purpose: history must survive deleted users.
create table if not exists public.audit_logs (
  id         uuid primary key default gen_random_uuid(),
  actor_id   uuid,
  actor_role public.app_role,
  action     text not null,
  entity     text not null,
  entity_id  text,
  before     jsonb,
  after      jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.ai_logs (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid,
  role       public.app_role,
  feature    public.ai_feature not null,
  input      text,
  tool_calls jsonb,
  output     text,
  latency_ms int check (latency_ms >= 0),
  success    boolean not null default false,
  error      text,
  created_at timestamptz not null default now()
);

-- -----------------------------------------------------------------------------
-- 6. Indexes (unique constraints above already index their columns,
--    including attendance (employee_id, work_date) and payroll_runs (month))
-- -----------------------------------------------------------------------------
create index if not exists attendance_work_date_idx on public.attendance (work_date);
create index if not exists leave_requests_employee_dates_idx on public.leave_requests (employee_id, start_date, end_date);
create index if not exists leave_requests_created_at_idx on public.leave_requests (created_at desc);
create index if not exists leave_requests_status_idx on public.leave_requests (status) where status = 'pending';
create index if not exists attendance_corrections_employee_idx on public.attendance_corrections (employee_id, work_date);
create index if not exists employees_department_idx on public.employees (department_id);
create index if not exists employees_designation_idx on public.employees (designation_id);
create index if not exists designations_department_idx on public.designations (department_id);
create index if not exists salary_structures_employee_idx on public.salary_structures (employee_id, effective_from desc);
create index if not exists payslips_employee_idx on public.payslips (employee_id);
create index if not exists announcements_created_at_idx on public.announcements (created_at desc);
create index if not exists notifications_user_created_idx on public.notifications (user_id, created_at desc);
create index if not exists notifications_unread_idx on public.notifications (user_id) where read_at is null;
create index if not exists audit_logs_created_at_idx on public.audit_logs (created_at desc);
create index if not exists audit_logs_entity_idx on public.audit_logs (entity, entity_id);
create index if not exists ai_logs_user_created_idx on public.ai_logs (user_id, created_at desc);

-- -----------------------------------------------------------------------------
-- 7. Triggers
-- -----------------------------------------------------------------------------
create or replace function public.tg_touch_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end
$$;

do $$
declare
  t text;
begin
  foreach t in array array[
    'company_settings', 'departments', 'designations', 'leave_types', 'holidays', 'employees',
    'app_users', 'attendance', 'attendance_corrections', 'leave_requests', 'payroll_runs', 'announcements'
  ] loop
    execute format(
      'create or replace trigger trg_touch_updated_at before update on public.%I
         for each row execute function public.tg_touch_updated_at()', t);
  end loop;
end
$$;

create or replace function public.tg_audit_logs_append_only()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception 'audit_logs is append-only'
    using errcode = 'P0001', detail = 'Audit entries can never be updated or deleted.';
end
$$;

create or replace trigger trg_audit_logs_append_only
  before update or delete on public.audit_logs
  for each row execute function public.tg_audit_logs_append_only();

-- A finalized run is locked forever. Draft -> finalized is still allowed (OLD is draft).
create or replace function public.tg_payroll_run_lock()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if old.status = 'finalized' then
    raise exception 'payroll_finalized'
      using errcode = 'P0001', detail = 'A finalized payroll run cannot be changed or deleted.';
  end if;
  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end
$$;

create or replace trigger trg_payroll_runs_lock
  before update or delete on public.payroll_runs
  for each row execute function public.tg_payroll_run_lock();

create or replace function public.tg_payslip_lock()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op in ('UPDATE', 'DELETE') and exists (
    select 1 from public.payroll_runs r where r.id = old.run_id and r.status = 'finalized'
  ) then
    raise exception 'payroll_finalized'
      using errcode = 'P0001', detail = 'Payslips of a finalized payroll run cannot change.';
  end if;
  if tg_op in ('INSERT', 'UPDATE') and exists (
    select 1 from public.payroll_runs r where r.id = new.run_id and r.status = 'finalized'
  ) then
    raise exception 'payroll_finalized'
      using errcode = 'P0001', detail = 'Payslips cannot be added to a finalized payroll run.';
  end if;
  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end
$$;

create or replace trigger trg_payslips_lock
  before insert or update or delete on public.payslips
  for each row execute function public.tg_payslip_lock();

-- -----------------------------------------------------------------------------
-- 8. Helper functions (Spec §6). Every dashboard number is built on these.
-- -----------------------------------------------------------------------------

-- Today's date in the company timezone.
create or replace function public.fn_company_today()
returns date
language sql
stable
security definer
set search_path = ''
as $$
  select (now() at time zone coalesce(
    (select cs.timezone from public.company_settings cs where cs.id = 1),
    'Asia/Karachi'
  ))::date
$$;

-- Weekday not in company_settings.weekend_days and not a holiday.
create or replace function public.fn_is_working_day(d date)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select not (
           extract(dow from d)::int = any (coalesce(
             (select cs.weekend_days from public.company_settings cs where cs.id = 1),
             '{0,6}'::int[]
           ))
         )
     and not exists (select 1 from public.holidays h where h.date = d)
$$;

-- Number of working days in [p_from, p_to], inclusive. 0 when p_from > p_to.
create or replace function public.fn_working_days(p_from date, p_to date)
returns int
language sql
stable
security definer
set search_path = ''
as $$
  with s as (
    select coalesce(
      (select cs.weekend_days from public.company_settings cs where cs.id = 1),
      '{0,6}'::int[]
    ) as weekend_days
  )
  select count(*)::int
  from s, generate_series(p_from, p_to, interval '1 day') as g (day)
  where not (extract(dow from g.day)::int = any (s.weekend_days))
    and not exists (select 1 from public.holidays h where h.date = g.day::date)
$$;

-- One row per (employee, day) the employee was employed (join_date <= day <= exit_date)
-- that is a working day or has an attendance row. effective_status, first match wins:
--   attendance without check-out, day before today -> missing_checkout
--   attendance                                      -> stored status (present | late | half_day)
--   approved leave covers the day                   -> on_leave
--   working day before today                        -> absent
--   otherwise (today / future, nothing recorded)    -> row omitted
create or replace function public.fn_attendance_days(p_from date, p_to date, p_dept uuid default null)
returns table (
  employee_id      uuid,
  department_id    uuid,
  work_date        date,
  is_working_day   boolean,
  effective_status text,
  attendance_id    uuid,
  check_in_at      timestamptz,
  check_out_at     timestamptz,
  leave_request_id uuid,
  leave_type_code  text
)
language sql
stable
security definer
set search_path = ''
as $$
  with s as (
    select
      coalesce(
        (select cs.weekend_days from public.company_settings cs where cs.id = 1),
        '{0,6}'::int[]
      ) as weekend_days,
      public.fn_company_today() as today
  ),
  days as (
    select
      g.day::date as d,
      (not (extract(dow from g.day)::int = any (s.weekend_days))
        and not exists (select 1 from public.holidays h where h.date = g.day::date)) as working
    from s, generate_series(p_from, p_to, interval '1 day') as g (day)
  ),
  base as (
    select
      e.id            as emp_id,
      e.department_id as dept_id,
      days.d,
      days.working,
      a.id            as att_id,
      a.check_in_at   as att_in,
      a.check_out_at  as att_out,
      a.status        as att_status,
      lv.id           as lv_id,
      lv.code         as lv_code
    from public.employees e
    join days
      on days.d >= e.join_date
     and (e.exit_date is null or days.d <= e.exit_date)
    left join public.attendance a
      on a.employee_id = e.id
     and a.work_date = days.d
    left join lateral (
      select lr.id, lt.code
      from public.leave_requests lr
      join public.leave_types lt on lt.id = lr.leave_type_id
      where lr.employee_id = e.id
        and lr.status = 'approved'
        and days.d between lr.start_date and lr.end_date
      limit 1
    ) lv on true
    where (p_dept is null or e.department_id = p_dept)
      and (days.working or a.id is not null)
  ),
  classified as (
    select
      b.*,
      case
        when b.att_id is not null and b.att_out is null and b.d < s.today then 'missing_checkout'
        when b.att_id is not null then b.att_status::text
        when b.lv_id is not null then 'on_leave'
        when b.d < s.today then 'absent'
      end as status
    from base b, s
  )
  select
    c.emp_id,
    c.dept_id,
    c.d,
    c.working,
    c.status,
    c.att_id,
    c.att_in,
    c.att_out,
    case when c.status = 'on_leave' then c.lv_id end,
    case when c.status = 'on_leave' then c.lv_code end
  from classified c
  where c.status is not null
  order by c.d, c.emp_id
$$;

-- Used by scripts/check-db.mjs: RLS flags, expected triggers and anon privileges.
create or replace function public.fn_schema_health()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  app_tables text[] := array[
    'company_settings', 'departments', 'designations', 'leave_types', 'holidays', 'employees',
    'app_users', 'salary_structures', 'attendance', 'attendance_corrections', 'leave_requests',
    'payroll_runs', 'payslips', 'announcements', 'notifications', 'audit_logs', 'ai_logs'
  ];
  result jsonb;
begin
  select jsonb_build_object(
    'tables', (
      select jsonb_agg(jsonb_build_object(
        'table', t,
        'exists', c.oid is not null,
        'rls', coalesce(c.relrowsecurity, false),
        'anon_access', coalesce(
          pg_catalog.has_table_privilege('anon', c.oid, 'SELECT, INSERT, UPDATE, DELETE')
          or pg_catalog.has_table_privilege('authenticated', c.oid, 'SELECT, INSERT, UPDATE, DELETE'),
          false)
      ) order by t)
      from unnest(app_tables) as t
      left join pg_catalog.pg_class c on c.oid = pg_catalog.to_regclass('public.' || t)
    ),
    'triggers', jsonb_build_object(
      'trg_touch_updated_at', (select count(*) from pg_catalog.pg_trigger where tgname = 'trg_touch_updated_at'),
      'trg_audit_logs_append_only', (select count(*) from pg_catalog.pg_trigger where tgname = 'trg_audit_logs_append_only'),
      'trg_payroll_runs_lock', (select count(*) from pg_catalog.pg_trigger where tgname = 'trg_payroll_runs_lock'),
      'trg_payslips_lock', (select count(*) from pg_catalog.pg_trigger where tgname = 'trg_payslips_lock')
    ),
    'anon_can_execute', (
      select coalesce(jsonb_agg(p.oid::regprocedure::text), '[]'::jsonb)
      from pg_catalog.pg_proc p
      join pg_catalog.pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'public'
        and (p.proname like 'fn\_%' or p.proname like 'tg\_%')
        and (pg_catalog.has_function_privilege('anon', p.oid, 'EXECUTE')
          or pg_catalog.has_function_privilege('authenticated', p.oid, 'EXECUTE'))
    )
  ) into result;
  return result;
end
$$;

-- -----------------------------------------------------------------------------
-- 9. Lock down: RLS on, no policies, no access for anon/authenticated.
--    Only the server (service_role / secret key) reads and writes.
-- -----------------------------------------------------------------------------
do $$
declare
  t text;
begin
  foreach t in array array[
    'company_settings', 'departments', 'designations', 'leave_types', 'holidays', 'employees',
    'app_users', 'salary_structures', 'attendance', 'attendance_corrections', 'leave_requests',
    'payroll_runs', 'payslips', 'announcements', 'notifications', 'audit_logs', 'ai_logs'
  ] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on table public.%I from anon, authenticated', t);
    execute format('grant select, insert, update, delete on table public.%I to service_role', t);
  end loop;
end
$$;

revoke all on sequence public.employee_code_seq from anon, authenticated;
grant usage, select on sequence public.employee_code_seq to service_role;

do $$
declare
  f regprocedure;
begin
  for f in
    select p.oid::regprocedure
    from pg_catalog.pg_proc p
    join pg_catalog.pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and (p.proname like 'fn\_%' or p.proname like 'tg\_%')
  loop
    execute format('revoke all on function %s from public, anon, authenticated', f);
    execute format('grant execute on function %s to service_role', f);
  end loop;
end
$$;

commit;
