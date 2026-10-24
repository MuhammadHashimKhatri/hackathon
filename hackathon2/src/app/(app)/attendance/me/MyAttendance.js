"use client";

import { useRouter } from "next/navigation";
import Badge, { STATUS } from "@/components/ui/Badge";
import Card from "@/components/ui/Card";
import EmptyState from "@/components/ui/EmptyState";
import StatCard from "@/components/ui/StatCard";
import Table from "@/components/ui/Table";
import { useToast } from "@/components/ui/Toast";
import MonthCalendar from "@/components/attendance/MonthCalendar";
import { formatDate } from "@/lib/format";

const SUMMARY = ["present", "late", "half_day", "absent", "on_leave", "missing_checkout"];

const times = (c) =>
  [c.requestedCheckIn ? `in ${c.requestedCheckIn}` : null, c.requestedCheckOut ? `out ${c.requestedCheckOut}` : null].filter(Boolean).join(", ");

export default function MyAttendance({ calendar, corrections }) {
  const router = useRouter();
  const { toast } = useToast();

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {SUMMARY.map((s) => (
          <StatCard key={s} label={STATUS[s].label} value={calendar.counts[s]} />
        ))}
      </div>
      <Card>
        <MonthCalendar
          calendar={calendar}
          canRequest
          onRequested={() => {
            toast({ tone: "success", title: "Correction sent to HR", description: "You'll get a notification when it's decided." });
            router.refresh();
          }}
        />
      </Card>
      <Card title="My correction requests" padding={false}>
        <div className="p-2 sm:p-3">
          <Table
            caption="My correction requests"
            rows={corrections}
            empty={<EmptyState compact title="No correction requests" description="Tap a day in the calendar to ask HR to fix it." />}
            columns={[
              { key: "day", header: "Day", render: (c) => <span className="font-medium">{formatDate(c.workDate)}</span> },
              { key: "times", header: "Asked for", render: times },
              { key: "reason", header: "Reason", render: (c) => c.reason, hideOnMobile: true },
              { key: "status", header: "Status", render: (c) => <Badge status={c.status} /> },
              { key: "comment", header: "HR comment", render: (c) => c.reviewComment ?? "—", hideOnMobile: true },
            ]}
          />
        </div>
      </Card>
    </div>
  );
}
