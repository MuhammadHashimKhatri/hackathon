"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Banknote, LogOut, Pencil, ReceiptText } from "lucide-react";
import { GENDER_LABELS, selfUpdateSchema } from "@/lib/validation/employees";
import { fieldErrorsOf } from "@/lib/validation/auth";
import { formStateFromError, patchJson } from "@/lib/api";
import { formatDate, formatMoney, formatMonth } from "@/lib/format";
import Badge, { STATUS } from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import Drawer from "@/components/ui/Drawer";
import EmptyState from "@/components/ui/EmptyState";
import FormAlert from "@/components/ui/FormAlert";
import Input from "@/components/ui/Input";
import PageHeader from "@/components/ui/PageHeader";
import StatCard from "@/components/ui/StatCard";
import Table from "@/components/ui/Table";
import Tabs from "@/components/ui/Tabs";
import Textarea from "@/components/ui/Textarea";
import { useToast } from "@/components/ui/Toast";
import MonthCalendar from "@/components/attendance/MonthCalendar";
import EmployeeForm from "./EmployeeForm";
import ExitDialog from "./ExitDialog";
import SalaryDialog from "./SalaryDialog";

function Details({ items }) {
  return (
    <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
      {items.map(([label, value]) => (
        <div key={label} className="min-w-0">
          <dt className="text-[0.8125rem] text-muted">{label}</dt>
          <dd className="mt-0.5 text-sm break-words text-ink">{value || "—"}</dd>
        </div>
      ))}
    </dl>
  );
}

function Overview({ employee, login }) {
  const loginText = !login
    ? "No login"
    : !login.isActive
      ? "Deactivated"
      : login.mustChangePassword
        ? "Active, temporary password not changed yet"
        : "Active";
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card title="Personal">
        <Details
          items={[
            ["Email", employee.email],
            ["Phone", employee.phone],
            ["Gender", GENDER_LABELS[employee.gender]],
            ["Date of birth", employee.dateOfBirth ? formatDate(employee.dateOfBirth) : null],
            ["Address", employee.address],
          ]}
        />
      </Card>
      <Card title="Job">
        <Details
          items={[
            ["Department", employee.departmentName],
            ["Designation", employee.designationTitle],
            ["Joined", formatDate(employee.joinDate)],
            ["Last working day", employee.exitDate ? formatDate(employee.exitDate) : null],
            ["Status", <Badge key="s" status={employee.status} />],
            ...(login !== undefined ? [["Login", loginText]] : []),
          ]}
        />
      </Card>
    </div>
  );
}

function SalaryTab({ salary, canManage, onSet }) {
  const { current, scheduled, history } = salary;
  const parts = current
    ? [
        ["Basic", current.basic],
        ["HRA (40%)", current.hra],
        ["Medical (10%)", current.medical],
      ]
    : [];
  return (
    <div className="flex flex-col gap-4">
      <Card
        title="Current salary"
        description={current ? `Since ${formatDate(current.effectiveFrom)}` : "No salary has started yet."}
        actions={canManage ? <Button size="sm" variant="primary" icon={Banknote} onClick={onSet}>Set new salary</Button> : null}
      >
        {current ? (
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <dl className="grid grid-cols-3 gap-4 text-sm">
              {parts.map(([label, value]) => (
                <div key={label}>
                  <dt className="text-[0.8125rem] text-muted">{label}</dt>
                  <dd className="figure mt-0.5">{formatMoney(value)}</dd>
                </div>
              ))}
            </dl>
            <div className="sm:text-right">
              <p className="text-[0.8125rem] text-muted">Gross per month</p>
              <p className="figure text-[1.75rem] leading-9 font-semibold tracking-tight">{formatMoney(current.gross)}</p>
            </div>
          </div>
        ) : null}
        {scheduled ? (
          <p className="mt-4 rounded-lg bg-info-soft px-3 py-2 text-[0.8125rem] text-info">
            Changes to {formatMoney(scheduled.basic)} basic on {formatDate(scheduled.effectiveFrom)}.
          </p>
        ) : null}
      </Card>
      <Card title="History" padding={false}>
        <div className="p-2 sm:p-3">
          <SalaryHistoryTable history={history} />
        </div>
      </Card>
    </div>
  );
}

export function SalaryHistoryTable({ history }) {
  return (
    <Table
      caption="Salary history"
      rows={history}
      empty={<EmptyState compact title="No salary records" />}
      columns={[
        { key: "effectiveFrom", header: "Effective from", render: (s) => formatDate(s.effectiveFrom) },
        { key: "basic", header: "Basic", align: "right", render: (s) => formatMoney(s.basic) },
        { key: "hra", header: "HRA", align: "right", render: (s) => formatMoney(s.hra), hideOnMobile: true },
        { key: "medical", header: "Medical", align: "right", render: (s) => formatMoney(s.medical), hideOnMobile: true },
        { key: "gross", header: "Gross", align: "right", render: (s) => formatMoney(s.gross) },
      ]}
    />
  );
}

const ATTENDANCE_ORDER = ["present", "late", "half_day", "missing_checkout", "absent", "on_leave"];

// Month calendar; the arrows load other months from the API in place.
function AttendanceTab({ employeeId, initial }) {
  const [calendar, setCalendar] = useState(initial);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);

  async function loadMonth(month) {
    setLoading(true);
    setFailed(false);
    try {
      const res = await fetch(`/api/employees/${employeeId}/attendance?month=${month}`);
      if (!res.ok) throw new Error(String(res.status));
      setCalendar(await res.json());
    } catch {
      setFailed(true);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {ATTENDANCE_ORDER.map((s) => (
          <StatCard key={s} label={STATUS[s].label} value={calendar.counts[s]} loading={loading} />
        ))}
      </div>
      <Card>
        <FormAlert className="mb-3">{failed ? "That month didn't load. Try again." : null}</FormAlert>
        <MonthCalendar calendar={calendar} onMonth={loadMonth} loading={loading} />
      </Card>
    </div>
  );
}

const days = (n) => (n === null ? "Unlimited" : `${n} ${Math.abs(n) === 1 ? "day" : "days"}`);

function LeaveTab({ balances, recent, year }) {
  return (
    <div className="flex flex-col gap-4">
      <Card title={`Balances for ${year}`} padding={false}>
        <div className="p-2 sm:p-3">
          <Table
            caption="Leave balances"
            rowKey="leaveTypeId"
            rows={balances}
            empty={<EmptyState compact title="No leave types yet" description="Admin adds leave types in Company Settings." />}
            columns={[
              { key: "name", header: "Leave type", render: (b) => <span className="font-medium">{b.name}</span> },
              { key: "quota", header: "Yearly quota", align: "right", render: (b) => days(b.quota) },
              { key: "approved", header: "Taken", align: "right", render: (b) => days(b.approved) },
              { key: "pending", header: "Pending", align: "right", render: (b) => days(b.pending) },
              { key: "available", header: "Available", align: "right", render: (b) => <span className="font-semibold">{days(b.available)}</span> },
            ]}
          />
        </div>
      </Card>
      <Card title="Recent requests" padding={false}>
        <div className="p-2 sm:p-3">
          <Table
            caption="Recent leave requests"
            rows={recent}
            empty={<EmptyState compact title="No leave requests yet" />}
            columns={[
              { key: "type", header: "Type", render: (r) => <span className="font-medium">{r.leaveType}</span> },
              {
                key: "dates",
                header: "Dates",
                render: (r) => (r.startDate === r.endDate ? formatDate(r.startDate) : `${formatDate(r.startDate)} to ${formatDate(r.endDate)}`),
              },
              { key: "days", header: "Days", align: "right", render: (r) => r.days },
              { key: "status", header: "Status", render: (r) => <Badge status={r.status} /> },
            ]}
          />
        </div>
      </Card>
    </div>
  );
}

function PayslipsTab({ payslips }) {
  return (
    <Card padding={false}>
      <div className="p-2 sm:p-3">
        <Table
          caption="Payslips"
          rows={payslips}
          empty={
            <EmptyState
              icon={ReceiptText}
              title="No payslips yet"
              description="Payslips appear here once a month's payroll is finalized."
            />
          }
          columns={[
            { key: "month", header: "Month", render: (p) => <span className="font-medium">{formatMonth(p.month)}</span> },
            { key: "gross", header: "Gross", align: "right", render: (p) => formatMoney(p.gross) },
            { key: "deduction", header: "Deductions", align: "right", render: (p) => formatMoney(p.deduction), hideOnMobile: true },
            { key: "tax", header: "Tax", align: "right", render: (p) => formatMoney(p.monthlyTax), hideOnMobile: true },
            { key: "net", header: "Net pay", align: "right", render: (p) => <span className="font-semibold">{formatMoney(p.net)}</span> },
            { key: "status", header: "Payroll", render: (p) => <Badge status={p.runStatus} /> },
          ]}
        />
      </div>
    </Card>
  );
}

// Employee's own edit: phone and address only.
function ContactForm({ employee, onSaved, onCancel }) {
  const [state, setState] = useState({});
  const [pending, startTransition] = useTransition();
  const errors = state.fieldErrors ?? {};

  function onSubmit(e) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const parsed = selfUpdateSchema.safeParse({ phone: String(form.get("phone") ?? ""), address: String(form.get("address") ?? "") });
    if (!parsed.success) {
      setState({ fieldErrors: fieldErrorsOf(parsed.error) });
      return;
    }
    startTransition(async () => {
      const result = await patchJson(`/api/employees/${employee.id}`, parsed.data);
      if (!result.ok) {
        setState(formStateFromError(result, "Updating your details isn't available right now."));
        return;
      }
      onSaved();
    });
  }

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
      <FormAlert>{state.formError}</FormAlert>
      <Input label="Phone" name="phone" type="tel" defaultValue={employee.phone ?? ""} error={errors.phone} />
      <Textarea label="Address" name="address" rows={3} defaultValue={employee.address ?? ""} error={errors.address} />
      <p className="text-[0.8125rem] text-muted">For any other change, such as your name or department, ask HR.</p>
      <div className="flex justify-end gap-2">
        <Button onClick={onCancel} disabled={pending}>
          Cancel
        </Button>
        <Button type="submit" variant="primary" loading={pending}>
          Save changes
        </Button>
      </div>
    </form>
  );
}

// mode: "hr" (manage), "admin" (view), "self" (an employee's own profile)
export default function Employee360({ data, mode, departments = [], designations = [] }) {
  const router = useRouter();
  const { toast } = useToast();
  const [tab, setTab] = useState("overview");
  const [dialog, setDialog] = useState(null); // "edit" | "salary" | "exit"
  const { employee, today } = data;
  const hr = mode === "hr";
  const exited = employee.status === "exited";
  const isSelfRecordForHr = hr && data.isOwnRecord;

  const tabs = [
    { id: "overview", label: "Overview" },
    ...(data.salary ? [{ id: "salary", label: "Salary" }] : []),
    { id: "attendance", label: "Attendance" },
    { id: "leave", label: "Leave" },
    { id: "payslips", label: "Payslips" },
  ];

  function done(title, description) {
    setDialog(null);
    toast({ title, description, tone: "success" });
    router.refresh();
  }

  const actions =
    mode === "self" ? (
      <Button icon={Pencil} onClick={() => setDialog("edit")}>
        Edit contact details
      </Button>
    ) : hr ? (
      <>
        <Button icon={Pencil} onClick={() => setDialog("edit")}>
          Edit
        </Button>
        {!exited && !isSelfRecordForHr ? (
          <Button variant="danger-ghost" icon={LogOut} onClick={() => setDialog("exit")}>
            Exit employee
          </Button>
        ) : null}
      </>
    ) : null;

  return (
    <>
      <PageHeader
        title={employee.fullName}
        breadcrumbs={mode === "self" ? undefined : [{ label: "Employees", href: "/employees" }, { label: employee.employeeCode }]}
        description={
          <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <span className="figure">{employee.employeeCode}</span>
            <span>{[employee.designationTitle, employee.departmentName].filter(Boolean).join(", ") || "No department"}</span>
            <Badge status={employee.status} />
          </span>
        }
        actions={actions}
      />

      <Tabs tabs={tabs} value={tab} onChange={setTab}>
        {(active) => {
          if (active === "salary") {
            return <SalaryTab salary={data.salary} canManage={hr && !isSelfRecordForHr} onSet={() => setDialog("salary")} />;
          }
          if (active === "attendance") return <AttendanceTab employeeId={employee.id} initial={data.attendance} />;
          if (active === "leave") return <LeaveTab balances={data.leaveBalances} recent={data.recentLeave} year={today.slice(0, 4)} />;
          if (active === "payslips") return <PayslipsTab payslips={data.payslips} />;
          return <Overview employee={employee} login={data.login} />;
        }}
      </Tabs>

      <Drawer
        open={dialog === "edit"}
        onClose={() => setDialog(null)}
        side="right"
        width="w-[min(40rem,100vw)]"
        title={mode === "self" ? "Edit contact details" : `Edit ${employee.fullName}`}
      >
        <div className="p-4 sm:p-5">
          {dialog === "edit" && mode === "self" ? (
            <ContactForm employee={employee} onCancel={() => setDialog(null)} onSaved={() => done("Contact details saved")} />
          ) : null}
          {dialog === "edit" && hr ? (
            <EmployeeForm
              employee={employee}
              departments={departments}
              designations={designations}
              today={today}
              onCancel={() => setDialog(null)}
              onSaved={() => done("Changes saved")}
            />
          ) : null}
        </div>
      </Drawer>
      {dialog === "salary" ? (
        <SalaryDialog
          employee={employee}
          today={today}
          onClose={() => setDialog(null)}
          onSaved={(s) => done("Salary saved", `${formatMoney(s.gross)} gross from ${formatDate(s.effectiveFrom)}`)}
        />
      ) : null}
      {dialog === "exit" ? (
        <ExitDialog
          employee={employee}
          today={today}
          onClose={() => setDialog(null)}
          onDone={(r) => done(`${employee.fullName} has exited`, r.loginDeactivated ? "Their login is deactivated." : undefined)}
        />
      ) : null}
    </>
  );
}
