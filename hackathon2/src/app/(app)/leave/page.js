import Link from "next/link";
import { CalendarCheck } from "lucide-react";
import Card from "@/components/ui/Card";
import EmptyState from "@/components/ui/EmptyState";
import PageHeader from "@/components/ui/PageHeader";
import RoleGate from "@/components/shell/RoleGate";
import { getPageActor } from "@/server/auth/session";
import { listLeave, upcomingLeave } from "@/server/services/leave";
import { leaveListQuery } from "@/lib/validation/leave";
import { firstValues } from "@/lib/searchParams";
import { formatDate } from "@/lib/format";
import { cn } from "@/lib/cn";
import LeaveInbox from "./LeaveInbox";

export const metadata = { title: "Leave" };

const TABS = [
  { id: "pending", label: "Waiting", href: "/leave" },
  { id: "decided", label: "Decided", href: "/leave?status=decided" },
];

const dates = (r) => (r.startDate === r.endDate ? formatDate(r.startDate) : `${formatDate(r.startDate)} to ${formatDate(r.endDate)}`);

async function Upcoming() {
  const actor = await getPageActor();
  const { from, to, requests } = await upcomingLeave(actor, 7);
  return (
    <Card title="On leave in the next 7 days" description={`${formatDate(from)} to ${formatDate(to)}, approved leave only.`}>
      {requests.length === 0 ? (
        <EmptyState compact icon={CalendarCheck} title="Nobody is on leave" description="Approved leave in this week shows up here." />
      ) : (
        <ul className="flex flex-col divide-y divide-line">
          {requests.map((r) => (
            <li key={r.id} className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5 py-2 first:pt-0 last:pb-0">
              <Link href={`/employees/${r.employeeId}`} className="font-medium hover:text-accent hover:underline">
                {r.employeeName}
              </Link>
              <span className="text-[0.8125rem] text-muted">
                {r.typeName}, {dates(r)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

async function Inbox({ searchParams }) {
  const actor = await getPageActor();
  const { status } = leaveListQuery.parse(firstValues(await searchParams));
  const tab = status === "pending" ? "pending" : "decided";
  const requests = await listLeave(actor, { status: tab });
  return (
    <>
      <nav aria-label="Requests" className="mb-4 flex gap-1 border-b border-line">
        {TABS.map((t) => (
          <Link
            key={t.id}
            href={t.href}
            aria-current={tab === t.id ? "page" : undefined}
            className={cn(
              "-mb-px border-b-2 px-3 py-2 text-sm font-medium",
              tab === t.id ? "border-accent text-ink" : "border-transparent text-muted hover:text-ink"
            )}
          >
            {t.label}
          </Link>
        ))}
      </nav>
      <LeaveInbox requests={requests} status={tab} canDecide={actor.role === "hr"} myEmployeeId={actor.employeeId} />
    </>
  );
}

export default function LeavePage({ searchParams }) {
  return (
    <RoleGate href="/leave">
      <PageHeader title="Leave" description="Leave requests from employees. HR approves or rejects with a comment; Admin can view." />
      <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,3fr)_minmax(0,1fr)]">
        <div className="min-w-0">
          <Inbox searchParams={searchParams} />
        </div>
        <Upcoming />
      </div>
    </RoleGate>
  );
}
