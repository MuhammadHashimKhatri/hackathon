import Link from "next/link";
import { CalendarDays, Megaphone, ReceiptText } from "lucide-react";
import Card from "@/components/ui/Card";
import EmptyState from "@/components/ui/EmptyState";
import PageHeader from "@/components/ui/PageHeader";
import StatCard from "@/components/ui/StatCard";
import CheckInWidget from "@/components/attendance/CheckInWidget";
import { formatMoney, formatMonth } from "@/lib/format";
import AnnouncementList from "./AnnouncementList";
import AskAssistantButton from "./AskAssistantButton";
import ChartPanel from "./ChartPanel";

// Spec §7 Employee dashboard: own numbers only.
export default function EmployeeDashboard({ data, today }) {
  return (
    <>
      <PageHeader title="Dashboard" description="Your attendance, leave and pay at a glance." />
      <div className="flex flex-col gap-4">
        <Card title="Today" description="Check in when you arrive and check out when you leave.">
          <CheckInWidget today={today} compact />
        </Card>
        {data.linked ? (
          <div className="grid grid-cols-2 gap-3">
            <StatCard
              label="Hours this week"
              value={`${data.week.hours} h`}
              hint={`Target ${data.week.target} h, ${Math.max(0, Math.round((data.week.target - data.week.hours) * 10) / 10)} h to go`}
            />
            <StatCard label="Late this month" value={data.lateThisMonth} />
          </div>
        ) : null}
        <div className="grid gap-4 lg:grid-cols-2">
          <ChartPanel
            title="Leave balances"
            icon={CalendarDays}
            actions={<Link href="/leave/me" className="text-sm font-medium text-accent hover:underline">Apply</Link>}
            empty={{ title: "No leave types yet", description: "Balances appear once Admin sets up leave types." }}
          >
            {data.balances?.length ? (
              <ul className="flex flex-col divide-y divide-line">
                {data.balances.map((b) => (
                  <li key={b.leaveTypeId} className="flex justify-between gap-3 py-2 text-sm first:pt-0 last:pb-0">
                    <span className="font-medium">{b.name}</span>
                    <span className="figure">{b.quota === null ? "No limit" : `${b.available} of ${b.quota} left`}</span>
                  </li>
                ))}
              </ul>
            ) : undefined}
          </ChartPanel>
          <ChartPanel title="Last payslip" icon={ReceiptText}>
            {data.lastPayslip ? (
              <div className="flex flex-wrap items-end justify-between gap-3">
                <div>
                  <p className="text-sm text-muted">{formatMonth(data.lastPayslip.month)}</p>
                  <p className="figure text-[1.75rem] leading-9 font-semibold">{formatMoney(data.lastPayslip.net)}</p>
                  <p className="text-[0.8125rem] text-muted">Net pay</p>
                </div>
                <a href={`/api/payslips/${data.lastPayslip.id}/pdf`} className="text-sm font-medium text-accent hover:underline">
                  Download PDF
                </a>
              </div>
            ) : (
              <EmptyState compact icon={ReceiptText} title="No payslips yet" description="Your payslip appears after payroll for a month is finalized." />
            )}
          </ChartPanel>
          <ChartPanel title="Announcements" icon={Megaphone}>
            <AnnouncementList items={data.announcements} />
          </ChartPanel>
          <Card title="Assistant" description="Ask about your leave balance, attendance or policies.">
            <AskAssistantButton />
          </Card>
        </div>
      </div>
    </>
  );
}
