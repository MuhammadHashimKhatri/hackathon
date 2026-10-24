import { Suspense } from "react";
import Link from "next/link";
import { CalendarX2, ClipboardCheck, SearchX, Users } from "lucide-react";
import Badge, { STATUS } from "@/components/ui/Badge";
import { ButtonLink } from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import EmptyState from "@/components/ui/EmptyState";
import PageHeader from "@/components/ui/PageHeader";
import Skeleton from "@/components/ui/Skeleton";
import Table from "@/components/ui/Table";
import RoleGate from "@/components/shell/RoleGate";
import { AppError } from "@/server/errors";
import { getPageActor } from "@/server/auth/session";
import { dailyBoard } from "@/server/services/attendance";
import { listDepartments } from "@/server/services/organization";
import { BOARD_STATUSES, boardQuery } from "@/lib/validation/attendance";
import { firstValues } from "@/lib/searchParams";
import { formatDate } from "@/lib/format";
import { cn } from "@/lib/cn";
import BoardControls from "./BoardControls";

export const metadata = { title: "Attendance" };

const SOURCE_LABELS = { web: "Web", camera: "Camera", correction: "Corrected" };
const worked = (m) => (m === null ? "—" : `${Math.floor(m / 60)} h ${String(m % 60).padStart(2, "0")}`);

const columns = [
  {
    key: "employee",
    header: "Employee",
    render: (r) => (
      <Link href={`/employees/${r.employeeId}`} className="group flex flex-col">
        <span className="font-medium group-hover:text-accent group-hover:underline">{r.fullName}</span>
        <span className="text-[0.8125rem] text-muted">
          <span className="figure">{r.employeeCode}</span>
          {r.departmentName ? `, ${r.departmentName}` : ""}
        </span>
      </Link>
    ),
  },
  { key: "status", header: "Status", render: (r) => <Badge status={r.status} /> },
  { key: "in", header: "In", align: "right", render: (r) => r.checkIn ?? "—" },
  { key: "out", header: "Out", align: "right", render: (r) => r.checkOut ?? "—" },
  { key: "worked", header: "Worked", align: "right", render: (r) => worked(r.workedMinutes), hideOnMobile: true },
  { key: "source", header: "Recorded by", render: (r) => (r.source ? SOURCE_LABELS[r.source] : "—"), hideOnMobile: true },
];

function hrefWith(params, updates) {
  const next = new URLSearchParams(Object.entries(params).filter(([, v]) => v));
  for (const [k, v] of Object.entries(updates)) {
    if (v) next.set(k, v);
    else next.delete(k);
  }
  const qs = next.toString();
  return qs ? `/attendance?${qs}` : "/attendance";
}

function Chip({ href, active, children }) {
  return (
    <Link
      href={href}
      aria-current={active ? "true" : undefined}
      className={cn(
        "rounded-full border px-3 py-1 text-[0.8125rem]",
        active ? "border-accent bg-accent-soft text-accent" : "border-line text-muted hover:text-ink"
      )}
    >
      {children}
    </Link>
  );
}

async function Board({ searchParams }) {
  const actor = await getPageActor();
  const params = firstValues(await searchParams);
  const query = boardQuery.parse(params);
  let board;
  try {
    board = await dailyBoard(actor, query);
  } catch (err) {
    if (!(err instanceof AppError) || err.status !== 422) throw err;
    return (
      <Card>
        <EmptyState icon={CalendarX2} title={err.message} action={<ButtonLink href="/attendance">Back to today</ButtonLink>} />
      </Card>
    );
  }
  const departments = await listDepartments(actor);
  const chips = BOARD_STATUSES.filter((s) => board.counts[s]);
  const dayNote = board.holidayName ?? (board.isWorkingDay ? null : "Off day: check-ins still count");

  return (
    <div className="flex flex-col gap-4">
      <BoardControls departments={departments} date={board.date} today={board.today} />
      <Card padding={false}>
        <div className="flex flex-col gap-3 p-4 sm:p-5">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="text-base font-semibold">
              {board.date === board.today ? "Today" : formatDate(board.date)}
              {dayNote ? <span className="ml-2 text-[0.8125rem] font-normal text-muted">{dayNote}</span> : null}
            </h2>
            <p className="text-[0.8125rem] text-muted">
              {board.total} {board.total === 1 ? "employee" : "employees"}
            </p>
          </div>
          {chips.length ? (
            <nav aria-label="Filter by status" className="flex flex-wrap gap-2">
              <Chip href={hrefWith(params, { status: null })} active={!query.status}>
                All <span className="figure">{board.total}</span>
              </Chip>
              {chips.map((s) => (
                <Chip key={s} href={hrefWith(params, { status: query.status === s ? null : s })} active={query.status === s}>
                  {STATUS[s].label} <span className="figure">{board.counts[s]}</span>
                </Chip>
              ))}
            </nav>
          ) : null}
        </div>
        <div className="border-t border-line p-2 sm:p-3">
          <Table
            columns={columns}
            rows={board.rows}
            rowKey="employeeId"
            caption="Attendance board"
            empty={
              board.total === 0 ? (
                <EmptyState icon={Users} title="No employees for this day" description="Nobody was employed on this date, or no one matches the search." />
              ) : (
                <EmptyState
                  icon={SearchX}
                  title="No one with this status"
                  action={<ButtonLink href={hrefWith(params, { status: null })} size="sm">Show everyone</ButtonLink>}
                />
              )
            }
          />
        </div>
      </Card>
    </div>
  );
}

export default function AttendancePage({ searchParams }) {
  return (
    <RoleGate href="/attendance">
      <PageHeader
        title="Attendance"
        description="Who is in, late, absent or on leave on any day."
        actions={<ButtonLink href="/attendance/corrections" icon={ClipboardCheck}>Correction requests</ButtonLink>}
      />
      <Suspense
        fallback={
          <div aria-busy aria-label="Loading attendance" className="flex flex-col gap-4">
            <Skeleton className="h-16 w-full" />
            <div className="rounded-xl border border-line bg-surface p-5">
              <Table columns={columns} loading />
            </div>
          </div>
        }
      >
        <Board searchParams={searchParams} />
      </Suspense>
    </RoleGate>
  );
}
