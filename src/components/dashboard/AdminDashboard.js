import { Suspense } from "react";
import Link from "next/link";
import { Megaphone, ScrollText, Users, Wallet } from "lucide-react";
import PageHeader from "@/components/ui/PageHeader";
import StatCard from "@/components/ui/StatCard";
import EmptyState from "@/components/ui/EmptyState";
import { formatDate, formatMoney } from "@/lib/format";
import AnnouncementList from "./AnnouncementList";
import ChartPanel from "./ChartPanel";
import { BarPanel } from "./Charts";
import DashboardFilters from "./DashboardFilters";
import SummarizeButton from "./SummarizeButton";

const time = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

// Spec §7 Admin dashboard. Every number comes from fn_dashboard (src/server/services/analytics.js).
export default function AdminDashboard({ data, departments }) {
  const m = data.metrics;
  const p = m.payroll;
  const people = m.headcount > 0;
  const split = [
    ...m.gender.map((g) => ({ label: g.gender[0].toUpperCase() + g.gender.slice(1), count: g.count })),
    ...m.tenure.map((t) => ({ label: t.bucket, count: t.count })),
  ];
  return (
    <>
      <PageHeader
        title="Dashboard"
        description={`Company-wide numbers from ${formatDate(m.filters.from)} to ${formatDate(m.filters.to)}.`}
        actions={
          <Suspense>
            <SummarizeButton />
          </Suspense>
        }
      />
      <div className="flex flex-col gap-4">
        <DashboardFilters departments={departments} />
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <StatCard label="Headcount" value={m.headcount} hint={`${m.exits} exits in range`} />
          <StatCard label="Attrition" value={`${m.attrition_pct}%`} hint="Exits ÷ average headcount" />
          <StatCard label="Payroll cost" value={formatMoney(p.cost_gross)} hint={`Net ${formatMoney(p.cost_net)}`} />
          <StatCard label="Average salary" value={p.avg_salary === null ? null : formatMoney(p.avg_salary)} hint="Mean monthly gross" />
        </div>
        <div className="grid gap-4 lg:grid-cols-2">
          <ChartPanel
            title="Headcount by department"
            icon={Users}
            empty={{ title: "No employees yet", description: "Add departments, then HR can register employees." }}
          >
            {people ? <BarPanel data={m.by_department} x="department" series={[{ key: "headcount", label: "Employees" }]} /> : undefined}
          </ChartPanel>
          <ChartPanel
            title="Payroll cost by department"
            icon={Wallet}
            empty={{ title: "No payroll runs yet", description: "Costs appear after HR runs payroll for a month." }}
          >
            {p.by_dept.length ? (
              <BarPanel data={p.by_dept} x="department" series={[{ key: "gross", label: "Gross" }, { key: "net", label: "Net" }]} />
            ) : undefined}
          </ChartPanel>
          <ChartPanel
            title="Gender and tenure"
            icon={Users}
            empty={{ title: "No employees yet", description: "The split appears once employees are registered." }}
          >
            {people ? <BarPanel data={split} x="label" layout="vertical" series={[{ key: "count", label: "Employees" }]} /> : undefined}
          </ChartPanel>
          <ChartPanel title="Recent activity" icon={ScrollText} actions={<Link href="/audit" className="text-sm font-medium text-accent hover:underline">Audit log</Link>}>
            {data.recentActivity.length ? (
              <ul className="flex flex-col divide-y divide-line text-sm">
                {data.recentActivity.map((e) => (
                  <li key={e.id} className="flex flex-wrap justify-between gap-x-3 py-2 first:pt-0 last:pb-0">
                    <span>
                      <span className="font-medium">{e.actorEmail ?? "System"}</span> {e.action} <span className="text-muted">{e.entity.replaceAll("_", " ")}</span>
                    </span>
                    <span className="text-[0.8125rem] text-muted">{time.format(new Date(e.createdAt))}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState compact icon={ScrollText} title="No activity yet" description="Changes made by Admin and HR are listed here." />
            )}
          </ChartPanel>
        </div>
        <ChartPanel title="Announcements" icon={Megaphone}>
          <AnnouncementList items={data.announcements} />
        </ChartPanel>
      </div>
    </>
  );
}
