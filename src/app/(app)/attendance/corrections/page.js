import Link from "next/link";
import PageHeader from "@/components/ui/PageHeader";
import RoleGate from "@/components/shell/RoleGate";
import { getPageActor } from "@/server/auth/session";
import { listCorrections } from "@/server/services/corrections";
import { correctionListQuery } from "@/lib/validation/attendance";
import { firstValues } from "@/lib/searchParams";
import { cn } from "@/lib/cn";
import CorrectionsInbox from "./CorrectionsInbox";

export const metadata = { title: "Attendance Corrections" };

const TABS = [
  { id: "pending", label: "Waiting", href: "/attendance/corrections" },
  { id: "decided", label: "Decided", href: "/attendance/corrections?status=decided" },
];

async function Inbox({ searchParams }) {
  const actor = await getPageActor();
  const { status } = correctionListQuery.parse(firstValues(await searchParams));
  const corrections = await listCorrections(actor, { status });
  return (
    <>
      <nav aria-label="Requests" className="mb-4 flex gap-1 border-b border-line">
        {TABS.map((t) => (
          <Link
            key={t.id}
            href={t.href}
            aria-current={status === t.id ? "page" : undefined}
            className={cn(
              "-mb-px border-b-2 px-3 py-2 text-sm font-medium",
              status === t.id ? "border-accent text-ink" : "border-transparent text-muted hover:text-ink"
            )}
          >
            {t.label}
          </Link>
        ))}
      </nav>
      <CorrectionsInbox corrections={corrections} status={status} canDecide={actor.role === "hr"} />
    </>
  );
}

export default function CorrectionsPage({ searchParams }) {
  return (
    <RoleGate href="/attendance/corrections">
      <PageHeader
        title="Attendance Corrections"
        description="Employees ask to fix a check-in or check-out. Approving rewrites that day and recalculates its status."
        breadcrumbs={[{ label: "Attendance", href: "/attendance" }, { label: "Corrections" }]}
      />
      <Inbox searchParams={searchParams} />
    </RoleGate>
  );
}
