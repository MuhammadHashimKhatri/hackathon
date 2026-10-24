-- =============================================================================
--  !!!  DESTRUCTIVE — DELETES ALL DATA  !!!
--
--  HCM Lite — reset.sql
--  Empties every HCM Lite table AND deletes every Supabase Auth user, so the
--  app opens on /setup like a fresh install (e.g. before judging).
--  The schema itself (tables, triggers, functions) is kept.
--
--  There is no undo. Only run this on a project whose data you want gone.
-- =============================================================================

begin;

-- TRUNCATE does not fire the row-level lock triggers (finalized payroll,
-- append-only audit log), so a full reset is still possible here.
truncate table
  public.ai_logs,
  public.audit_logs,
  public.notifications,
  public.announcements,
  public.payslips,
  public.payroll_runs,
  public.leave_requests,
  public.attendance_corrections,
  public.attendance,
  public.salary_structures,
  public.app_users,
  public.employees,
  public.holidays,
  public.leave_types,
  public.designations,
  public.departments,
  public.company_settings
restart identity cascade;

alter sequence public.employee_code_seq restart with 1;

delete from auth.users;

commit;

select 'HCM Lite data and auth users deleted' as result;
