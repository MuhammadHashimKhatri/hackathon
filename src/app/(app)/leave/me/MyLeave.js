"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CalendarPlus, X } from "lucide-react";
import { leaveApplySchema } from "@/lib/validation/leave";
import { fieldErrorsOf } from "@/lib/validation/auth";
import { countLeaveDays } from "@/lib/leaveDays";
import { formStateFromError, postJson } from "@/lib/api";
import { formatDate } from "@/lib/format";
import { cn } from "@/lib/cn";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import DatePicker from "@/components/ui/DatePicker";
import EmptyState from "@/components/ui/EmptyState";
import FormAlert from "@/components/ui/FormAlert";
import Select from "@/components/ui/Select";
import Table from "@/components/ui/Table";
import Textarea from "@/components/ui/Textarea";
import { useToast } from "@/components/ui/Toast";

const dayWord = (n) => `${n} ${n === 1 ? "day" : "days"}`;
const dates = (r) => (r.startDate === r.endDate ? formatDate(r.startDate) : `${formatDate(r.startDate)} to ${formatDate(r.endDate)}`);

const EMPTY = { leaveTypeId: "", startDate: "", endDate: "", reason: "" };

function BalanceCard({ b }) {
  const unlimited = b.quota === null;
  return (
    <div className="flex min-w-0 flex-col gap-1 rounded-xl border border-line bg-surface p-4">
      <p className="truncate text-[0.8125rem] text-muted">{b.name}</p>
      <p className="figure text-[1.75rem] leading-9 font-semibold tracking-tight text-ink">
        {unlimited ? "No limit" : b.available}
        {unlimited ? null : <span className="text-sm font-normal text-muted"> of {b.quota} left</span>}
      </p>
      <p className="text-[0.8125rem] text-muted">
        Taken {b.approved}
        {b.pending ? `, ${b.pending} pending` : ""}
      </p>
    </div>
  );
}

// Live count of working days, using the same rule as the server.
function Preview({ form, context, balance }) {
  if (!form.startDate || !form.endDate || form.endDate < form.startDate) return null;
  const days = countLeaveDays(form.startDate, form.endDate, context);
  const over = balance && balance.available !== null && days > balance.available;
  return (
    <p
      role="status"
      className={cn(
        "rounded-lg px-3 py-2 text-sm",
        days === 0 || over ? "bg-warning-soft text-warning" : "bg-surface-2 text-ink"
      )}
    >
      {days === 0 ? (
        "These dates are all weekends or holidays, so no leave is needed."
      ) : (
        <>
          <span className="figure font-semibold">{dayWord(days)}</span> of leave (weekends and holidays don&apos;t count)
          {balance && balance.available !== null ? `. ${dayWord(Math.max(balance.available, 0))} of ${balance.name} available.` : "."}
        </>
      )}
    </p>
  );
}

function ApplyForm({ balances, context, onApplied }) {
  const [form, setForm] = useState(EMPTY);
  const [state, setState] = useState({});
  const [pending, startTransition] = useTransition();
  const balance = balances.find((b) => b.leaveTypeId === form.leaveTypeId);
  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  function onSubmit(e) {
    e.preventDefault();
    const parsed = leaveApplySchema.safeParse(form);
    if (!parsed.success) {
      setState({ fieldErrors: fieldErrorsOf(parsed.error) });
      return;
    }
    startTransition(async () => {
      const result = await postJson("/api/leave", parsed.data);
      if (!result.ok) {
        setState(formStateFromError(result, "Applying for leave isn't available right now."));
        return;
      }
      setForm(EMPTY);
      setState({});
      onApplied(result.data.request);
    });
  }

  return (
    <Card title="Apply for leave" description="HR gets a notification and decides. You can cancel while it's pending.">
      <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
        <FormAlert>{state.formError}</FormAlert>
        <Select
          label="Leave type"
          name="leaveTypeId"
          required
          placeholder="Choose a leave type"
          value={form.leaveTypeId}
          onChange={set("leaveTypeId")}
          options={balances.map((b) => ({
            value: b.leaveTypeId,
            label: b.quota === null ? `${b.name} (no limit)` : `${b.name} (${b.available} left)`,
          }))}
          error={state.fieldErrors?.leaveTypeId}
        />
        <div className="grid gap-4 sm:grid-cols-2">
          <DatePicker label="From" name="startDate" required value={form.startDate} onChange={set("startDate")} error={state.fieldErrors?.startDate} />
          <DatePicker
            label="To"
            name="endDate"
            required
            min={form.startDate || undefined}
            value={form.endDate}
            onChange={set("endDate")}
            error={state.fieldErrors?.endDate}
          />
        </div>
        <Preview form={form} context={context} balance={balance} />
        <Textarea label="Reason" name="reason" rows={3} required value={form.reason} onChange={set("reason")} error={state.fieldErrors?.reason} />
        <div className="flex justify-end">
          <Button type="submit" variant="primary" icon={CalendarPlus} loading={pending}>
            Send request
          </Button>
        </div>
      </form>
    </Card>
  );
}

export default function MyLeave({ balances, requests, context }) {
  const router = useRouter();
  const { toast } = useToast();
  const [cancelling, setCancelling] = useState(null);
  const [cancelPending, startCancel] = useTransition();

  function confirmCancel() {
    startCancel(async () => {
      const result = await postJson(`/api/leave/${cancelling.id}/cancel`);
      setCancelling(null);
      if (!result.ok) {
        toast({ tone: "danger", title: "Couldn't cancel", description: result.error?.message ?? "Try again." });
        return;
      }
      toast({ tone: "success", title: "Leave cancelled", description: dates(result.data.request) });
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <section aria-label={`Leave balances for ${context.year}`} className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {balances.map((b) => (
          <BalanceCard key={b.leaveTypeId} b={b} />
        ))}
      </section>
      <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
        <ApplyForm
          balances={balances}
          context={context}
          onApplied={(r) => {
            toast({ tone: "success", title: "Leave request sent", description: `${r.typeName}, ${dates(r)} (${dayWord(r.days)})` });
            router.refresh();
          }}
        />
        <Card title="My requests" padding={false}>
          <div className="p-2 sm:p-3">
            <Table
              caption="My leave requests"
              rows={requests}
              empty={<EmptyState compact title="No leave requests yet" description="Requests you send appear here with HR's decision." />}
              columns={[
                { key: "type", header: "Type", render: (r) => <span className="font-medium">{r.typeName}</span> },
                { key: "dates", header: "Dates", render: dates },
                { key: "days", header: "Days", align: "right", render: (r) => <span className="figure">{r.days}</span> },
                { key: "status", header: "Status", render: (r) => <Badge status={r.status} /> },
                { key: "comment", header: "HR comment", render: (r) => r.reviewComment ?? "—", hideOnMobile: true },
                {
                  key: "actions",
                  header: <span className="sr-only">Actions</span>,
                  align: "right",
                  render: (r) =>
                    r.canCancel ? (
                      <Button size="sm" variant="danger-ghost" icon={X} onClick={() => setCancelling(r)}>
                        Cancel
                      </Button>
                    ) : null,
                },
              ]}
            />
          </div>
        </Card>
      </div>
      <ConfirmDialog
        open={Boolean(cancelling)}
        onClose={() => setCancelling(null)}
        onConfirm={confirmCancel}
        pending={cancelPending}
        variant="danger"
        confirmLabel="Cancel leave"
        title="Cancel this leave request?"
        description={cancelling ? `${cancelling.typeName}, ${dates(cancelling)}. HR is told if it was already approved.` : ""}
      />
    </div>
  );
}
