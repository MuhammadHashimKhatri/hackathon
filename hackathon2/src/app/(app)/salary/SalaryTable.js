"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Banknote, History, SearchX, Users } from "lucide-react";
import { formatDate, formatMoney } from "@/lib/format";
import Button, { ButtonLink } from "@/components/ui/Button";
import Drawer from "@/components/ui/Drawer";
import EmptyState from "@/components/ui/EmptyState";
import ErrorState from "@/components/ui/ErrorState";
import Table from "@/components/ui/Table";
import { useToast } from "@/components/ui/Toast";
import { SalaryHistoryTable } from "@/components/employees/Employee360";
import SalaryDialog from "@/components/employees/SalaryDialog";

// history: { status: "loading" | "ready" | "error", rows }
function HistoryDrawer({ employee, history, onRetry, onClose }) {
  return (
    <Drawer open={Boolean(employee)} onClose={onClose} side="right" width="w-[min(36rem,100vw)]" title={employee ? `${employee.fullName}: salary history` : ""}>
      <div className="p-4 sm:p-5">
        {history.status === "error" ? <ErrorState title="Salary history didn't load" onRetry={onRetry} /> : null}
        {history.status === "loading" ? <Table loading columns={[]} /> : null}
        {history.status === "ready" ? <SalaryHistoryTable history={history.rows} /> : null}
      </div>
    </Drawer>
  );
}

export default function SalaryTable({ rows, today, canManage, currentEmployeeId, filtered }) {
  const router = useRouter();
  const { toast } = useToast();
  const [historyFor, setHistoryFor] = useState(null);
  const [history, setHistory] = useState({ status: "loading", rows: [] });
  const [settingFor, setSettingFor] = useState(null);

  async function openHistory(employee) {
    setHistoryFor(employee);
    setHistory({ status: "loading", rows: [] });
    try {
      const res = await fetch(`/api/employees/${employee.id}/salary`);
      if (!res.ok) throw new Error(String(res.status));
      setHistory({ status: "ready", rows: (await res.json()).history });
    } catch {
      setHistory({ status: "error", rows: [] });
    }
  }

  const columns = [
    {
      key: "name",
      header: "Employee",
      render: (e) => (
        <Link href={`/employees/${e.id}`} className="group flex flex-col">
          <span className="font-medium group-hover:text-accent group-hover:underline">{e.fullName}</span>
          <span className="figure text-[0.8125rem] text-muted">
            {e.employeeCode}
            {e.departmentName ? `, ${e.departmentName}` : ""}
          </span>
        </Link>
      ),
    },
    { key: "basic", header: "Basic", align: "right", render: (e) => formatMoney(e.current?.basic) },
    { key: "hra", header: "HRA", align: "right", render: (e) => formatMoney(e.current?.hra), hideOnMobile: true },
    { key: "medical", header: "Medical", align: "right", render: (e) => formatMoney(e.current?.medical), hideOnMobile: true },
    { key: "gross", header: "Gross", align: "right", render: (e) => <span className="font-semibold">{formatMoney(e.current?.gross)}</span> },
    {
      key: "since",
      header: "Since",
      render: (e) => (
        <span className="flex flex-col md:items-start">
          <span>{e.current ? formatDate(e.current.effectiveFrom) : "Not started"}</span>
          {e.scheduled ? <span className="text-[0.8125rem] text-info">Changes {formatDate(e.scheduled.effectiveFrom)}</span> : null}
        </span>
      ),
    },
    {
      key: "actions",
      header: <span className="sr-only">Actions</span>,
      mobileLabel: "Actions",
      align: "right",
      render: (e) => (
        <span className="inline-flex flex-wrap justify-end gap-2">
          <Button size="sm" variant="ghost" icon={History} onClick={() => openHistory(e)}>
            History
          </Button>
          {canManage && e.id !== currentEmployeeId && e.status !== "exited" ? (
            <Button size="sm" icon={Banknote} onClick={() => setSettingFor(e)}>
              Set salary
            </Button>
          ) : null}
        </span>
      ),
    },
  ];

  const empty = filtered ? (
    <EmptyState icon={SearchX} title="No employees match" action={<ButtonLink href="/salary" size="sm">Clear filters</ButtonLink>} />
  ) : (
    <EmptyState
      icon={Users}
      title="No employees yet"
      description="Each employee's first salary is set when HR registers them."
      action={canManage ? <ButtonLink href="/employees/new" variant="primary">Register employee</ButtonLink> : null}
    />
  );

  return (
    <>
      <Table columns={columns} rows={rows} caption="Salary structures" empty={empty} />
      <HistoryDrawer employee={historyFor} history={history} onRetry={() => openHistory(historyFor)} onClose={() => setHistoryFor(null)} />
      {settingFor ? (
        <SalaryDialog
          employee={settingFor}
          today={today}
          onClose={() => setSettingFor(null)}
          onSaved={(s) => {
            setSettingFor(null);
            toast({ title: "Salary saved", description: `${formatMoney(s.gross)} gross from ${formatDate(s.effectiveFrom)}`, tone: "success" });
            router.refresh();
          }}
        />
      ) : null}
    </>
  );
}
