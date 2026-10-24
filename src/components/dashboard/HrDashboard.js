import { Suspense } from "react";
import Link from "next/link";
import { CalendarCheck, Clock, Megaphone, TrendingUp, Users } from "lucide-react";
import PageHeader from "@/components/ui/PageHeader";
import StatCard from "@/components/ui/StatCard";
import { formatDate } from "@/lib/format";
import AnnouncementList from "./AnnouncementList";
import ChartPanel from "./ChartPanel";
import { BarPanel, LinePanel } from "./Charts";
import DashboardFilters from "./DashboardFilters";
import SummarizeButton from "./SummarizeButton";

const pct = (v) => (v === null || v === undefined ? null : `${v}%`);

// Spec §7 HR dashboard. Every number comes from fn_dashboard (src/server/services/analytics.js).
export default function HrDashboard({ data, departments }) {
  const m = data.metrics;
  const a = m.attendance;
  const hasAttendance = a.records > 0;
  const leaveRows = m.leave_by_type.filter((l) => Number(l.approved_ytd) > 0 || Number(l.days_in_range) > 0);
  return (
    <>
      <PageHeader
        title="Dashboard"
        description={`Attendance, leave and approvals from ${formatDate(m.filters.from)} to ${formatDate(m.filters.to)}.`}
        actions={
          <Suspense>
            <SummarizeButton />
          </Suspense>
        }
      />
      <div className="flex flex-col gap-4">
        <DashboardFilters departments={departments} />
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
          <StatCard label="Headcount" value={m.headcount} />
          <StatCard label="Present today" value={m.today.present} />
          <StatCard label="On leave today" value={m.today.on_leave} />
          <StatCard label="Late today" value={m.today.late} />
          <StatCard
            label="Pending approvals"
            value={m.pending_leave + m.pending_corrections}
            hint={`${m.pending_leave} leave, ${m.pending_corrections} corrections`}
            className="col-span-2 md:col-span-1"
          />
        </div>
        <div className="grid grid-cols-3 gap-3">
          <StatCard label="Attendance rate" value={pct(a.rate_pct)} hint="In the selected range" />
          <StatCard label="Late %" value={pct(a.late_pct)} />
          <StatCard label="Absenteeism" value={pct(a.absenteeism_pct)} />
        </div>
        <ChartPanel
          title="Attendance trend"
          description="Attendance rate per day (%)"
          icon={TrendingUp}
          empty={{ title: "No attendance yet", description: "The trend starts with the first check-in." }}
        >
          {hasAttendance ? <LinePanel data={m.trend} x="date" unit="%" series={[{ key: "rate_pct", label: "Attendance %" }]} /> : undefined}
        </ChartPanel>
        <div className="grid gap-4 lg:grid-cols-2">
          <ChartPanel
            title="Absenteeism by department"
            description="Absent days on working days"
            icon={Users}
            empty={{ title: "No attendance yet", description: "Absences are counted per department on working days." }}
          >
            {hasAttendance ? <BarPanel data={m.absenteeism_by_dept} x="department" series={[{ key: "absent", label: "Absent days" }]} /> : undefined}
          </ChartPanel>
          <ChartPanel
            title="Leave by type"
            description="Approved days this year"
            icon={CalendarCheck}
            empty={{ title: "No leave taken yet", description: "Approved leave is grouped by leave type here." }}
          >
            {leaveRows.length ? <BarPanel data={leaveRows} x="name" series={[{ key: "approved_ytd", label: "Approved days" }]} /> : undefined}
          </ChartPanel>
          <ChartPanel
            title="Top 5 late-comers"
            icon={Clock}
            empty={{ title: "No late check-ins", description: "Employees who check in after the grace period appear here." }}
          >
            {m.top_late.length ? (
              <ol className="flex flex-col divide-y divide-line">
                {m.top_late.map((l, i) => (
                  <li key={l.employee_id} className="flex items-center justify-between gap-3 py-2 first:pt-0 last:pb-0">
                    <Link href={`/employees/${l.employee_id}`} className="min-w-0 truncate font-medium hover:text-accent hover:underline">
                      {i + 1}. {l.name} <span className="figure text-[0.8125rem] font-normal text-muted">{l.code}</span>
                    </Link>
                    <span className="figure text-sm">{l.late} late</span>
                  </li>
                ))}
              </ol>
            ) : undefined}
          </ChartPanel>
          <ChartPanel title="Announcements" icon={Megaphone}>
            <AnnouncementList items={data.announcements} />
          </ChartPanel>
        </div>
      </div>
    </>
  );
}
