"use client";

import { useActionState, useState, useTransition } from "react";
import { usePathname, useRouter } from "next/navigation";
import { CalendarDays, CalendarRange, ListPlus, Pencil, Plus, Trash2 } from "lucide-react";
import {
  holidaySchema,
  LEAVE_CODES,
  leaveTypeCreateSchema,
  leaveTypeUpdateSchema,
} from "@/lib/validation/organization";
import { fieldErrorsOf } from "@/lib/validation/auth";
import { deleteJson, formStateFromError, patchJson, postJson } from "@/lib/api";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import Checkbox from "@/components/ui/Checkbox";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import DatePicker from "@/components/ui/DatePicker";
import Dialog from "@/components/ui/Dialog";
import EmptyState from "@/components/ui/EmptyState";
import FormAlert from "@/components/ui/FormAlert";
import Input from "@/components/ui/Input";
import Select from "@/components/ui/Select";
import Table from "@/components/ui/Table";
import Tabs from "@/components/ui/Tabs";
import { useToast } from "@/components/ui/Toast";

const CODE_LABELS = { annual: "Annual", sick: "Sick", casual: "Casual", unpaid: "Unpaid" };
const holidayDate = new Intl.DateTimeFormat("en-GB", { weekday: "short", day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
const formatDate = (iso) => holidayDate.format(new Date(`${iso}T00:00:00Z`));
const listJoin = new Intl.ListFormat("en", { type: "conjunction" });

function LeaveTypeDialog({ leaveType, freeCodes, onClose, onSaved }) {
  const editing = Boolean(leaveType);
  const [unlimited, setUnlimited] = useState(editing ? leaveType.yearlyQuota === null : false);
  const [state, formAction, pending] = useActionState(async (_prev, formData) => {
    const quotaText = String(formData.get("yearlyQuota") ?? "").trim();
    const fields = {
      name: formData.get("name"),
      yearlyQuota: unlimited ? null : quotaText === "" ? Number.NaN : Number(quotaText),
      isPaid: formData.get("isPaid") === "on",
    };
    const parsed = editing
      ? leaveTypeUpdateSchema.safeParse(fields)
      : leaveTypeCreateSchema.safeParse({ code: formData.get("code"), ...fields });
    if (!parsed.success) return { fieldErrors: fieldErrorsOf(parsed.error) };
    const result = editing
      ? await patchJson(`/api/leave-types/${leaveType.id}`, parsed.data)
      : await postJson("/api/leave-types", parsed.data);
    if (!result.ok) return formStateFromError(result, "Saving leave types isn't available right now.");
    onSaved(editing ? "Leave type updated" : "Leave type added");
    return {};
  }, {});
  const errors = state.fieldErrors ?? {};

  return (
    <Dialog open onClose={onClose} title={editing ? `Edit ${leaveType.name}` : "Add leave type"}>
      <form action={formAction} noValidate className="flex flex-col gap-4">
        <FormAlert>{state.formError}</FormAlert>
        {editing ? null : (
          <Select
            label="Type"
            name="code"
            options={freeCodes.map((c) => ({ value: c, label: CODE_LABELS[c] }))}
            hint="The assistant and payroll recognise these four types."
            error={errors.code}
          />
        )}
        <Input label="Name" name="name" defaultValue={leaveType?.name} error={errors.name} required autoFocus />
        <div className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
          <Input
            label="Days per year"
            name="yearlyQuota"
            type="number"
            min={0}
            max={366}
            disabled={unlimited}
            defaultValue={leaveType?.yearlyQuota ?? ""}
            error={errors.yearlyQuota}
          />
          <Checkbox
            label="Unlimited"
            name="unlimited"
            checked={unlimited}
            onChange={(e) => setUnlimited(e.target.checked)}
            className="sm:pb-2.5"
          />
        </div>
        <Checkbox
          label="Paid leave"
          name="isPaid"
          defaultChecked={leaveType ? leaveType.isPaid : true}
          description="Unpaid leave days are deducted in payroll."
        />
        <div className="flex justify-end gap-2">
          <Button onClick={onClose} disabled={pending}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" loading={pending}>
            {editing ? "Save leave type" : "Add leave type"}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}

function HolidayDialog({ holiday, year, onClose, onSaved }) {
  const editing = Boolean(holiday);
  const [state, formAction, pending] = useActionState(async (_prev, formData) => {
    const parsed = holidaySchema.safeParse({ date: formData.get("date"), name: formData.get("name") });
    if (!parsed.success) return { fieldErrors: fieldErrorsOf(parsed.error) };
    const result = editing
      ? await patchJson(`/api/holidays/${holiday.id}`, parsed.data)
      : await postJson("/api/holidays", parsed.data);
    if (!result.ok) return formStateFromError(result, "Saving holidays isn't available right now.");
    onSaved(editing ? "Holiday updated" : "Holiday added", Number(parsed.data.date.slice(0, 4)));
    return {};
  }, {});
  const errors = state.fieldErrors ?? {};

  return (
    <Dialog open onClose={onClose} title={editing ? "Edit holiday" : "Add holiday"}>
      <form action={formAction} noValidate className="flex flex-col gap-4">
        <FormAlert>{state.formError}</FormAlert>
        <DatePicker
          label="Date"
          name="date"
          defaultValue={holiday?.date ?? ""}
          min={`${year - 1}-01-01`}
          error={errors.date}
          required
          autoFocus
        />
        <Input label="Name" name="name" placeholder="Independence Day" defaultValue={holiday?.name} error={errors.name} required />
        <div className="flex justify-end gap-2">
          <Button onClick={onClose} disabled={pending}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" loading={pending}>
            {editing ? "Save holiday" : "Add holiday"}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}

export default function LeaveSetup({ tab, leaveTypes, holidays, year, yearOptions, canEdit }) {
  const router = useRouter();
  const pathname = usePathname();
  const { toast } = useToast();
  const [dialog, setDialog] = useState(null); // { kind: "type" | "holiday", item? }
  const [confirm, setConfirm] = useState(null); // { kind, item }
  const [pending, startTransition] = useTransition();

  const usedCodes = new Set(leaveTypes.map((t) => t.code));
  const freeCodes = LEAVE_CODES.filter((c) => !usedCodes.has(c));

  const go = (params) => router.replace(`${pathname}?${new URLSearchParams(params)}`, { scroll: false });

  function saved(title, holidayYear) {
    setDialog(null);
    toast({ title, tone: "success" });
    if (holidayYear && holidayYear !== year) go({ tab: "holidays", year: String(holidayYear) });
    else router.refresh();
  }

  function addStandard() {
    startTransition(async () => {
      const result = await postJson("/api/leave-types/standard");
      if (!result.ok) {
        toast({ title: "Not added", description: result.error?.message ?? "Try again.", tone: "danger" });
        return;
      }
      const { added } = result.data;
      toast({
        title: added.length ? `Added ${listJoin.format(added.map((c) => CODE_LABELS[c].toLowerCase()))} leave` : "All standard leave types already exist",
        tone: "success",
      });
      router.refresh();
    });
  }

  function runDelete() {
    const { kind, item } = confirm;
    startTransition(async () => {
      const result = await deleteJson(kind === "type" ? `/api/leave-types/${item.id}` : `/api/holidays/${item.id}`);
      setConfirm(null);
      if (!result.ok) {
        toast({ title: "Not deleted", description: result.error?.message ?? "Try again.", tone: "danger" });
        return;
      }
      toast({ title: kind === "type" ? "Leave type deleted" : "Holiday deleted", tone: "success" });
      router.refresh();
    });
  }

  const rowActions = (kind, item, label) =>
    canEdit ? (
      <span className="inline-flex justify-end gap-1">
        <Button size="icon" variant="ghost" icon={Pencil} aria-label={`Edit ${label}`} onClick={() => setDialog({ kind, item })} />
        <Button size="icon" variant="danger-ghost" icon={Trash2} aria-label={`Delete ${label}`} onClick={() => setConfirm({ kind, item })} />
      </span>
    ) : null;

  const typeColumns = [
    {
      key: "name",
      header: "Leave type",
      render: (t) => (
        <span>
          <span className="font-medium">{t.name}</span>
          <span className="ml-2 text-[0.8125rem] text-muted">{t.code}</span>
        </span>
      ),
    },
    {
      key: "quota",
      header: "Per year",
      align: "right",
      render: (t) => (t.yearlyQuota === null ? "Unlimited" : `${t.yearlyQuota} days`),
    },
    { key: "paid", header: "Pay", render: (t) => (t.isPaid ? <Badge tone="success">Paid</Badge> : <Badge tone="neutral">Unpaid</Badge>) },
    ...(canEdit ? [{ key: "actions", header: <span className="sr-only">Actions</span>, mobileLabel: "Actions", align: "right", render: (t) => rowActions("type", t, t.name) }] : []),
  ];

  const holidayColumns = [
    { key: "date", header: "Date", render: (h) => <span className="figure font-medium">{formatDate(h.date)}</span> },
    { key: "name", header: "Holiday" },
    ...(canEdit ? [{ key: "actions", header: <span className="sr-only">Actions</span>, mobileLabel: "Actions", align: "right", render: (h) => rowActions("holiday", h, h.name) }] : []),
  ];

  return (
    <>
      <Tabs
        tabs={[
          { id: "types", label: "Leave types" },
          { id: "holidays", label: "Holidays" },
        ]}
        value={tab}
        onChange={(id) => go(id === "holidays" ? { tab: id, year: String(year) } : { tab: id })}
      >
        {(active) =>
          active === "types" ? (
            <Card
              title="Leave types"
              description="Quotas reset every calendar year. Unlimited types have no balance."
              actions={
                canEdit ? (
                  <>
                    {freeCodes.length ? (
                      <Button size="sm" icon={ListPlus} onClick={addStandard} loading={pending && !confirm}>
                        Add standard leave types
                      </Button>
                    ) : null}
                    {freeCodes.length ? (
                      <Button size="sm" variant="primary" icon={Plus} onClick={() => setDialog({ kind: "type" })}>
                        Add leave type
                      </Button>
                    ) : null}
                  </>
                ) : null
              }
            >
              <Table
                columns={typeColumns}
                rows={leaveTypes}
                caption="Leave types"
                empty={
                  <EmptyState
                    icon={CalendarRange}
                    title="No leave types yet"
                    description={
                      canEdit
                        ? "Add the standard set (annual 14, sick 8, casual 10, unpaid unlimited) or your own."
                        : "Admin hasn't set up leave types yet."
                    }
                  />
                }
              />
            </Card>
          ) : (
            <Card
              title="Holidays"
              description="Holidays don't count as working days for attendance, leave or payroll."
              actions={
                <>
                  <Select
                    aria-label="Year"
                    name="year"
                    value={String(year)}
                    options={yearOptions.map((y) => ({ value: String(y), label: String(y) }))}
                    onChange={(e) => go({ tab: "holidays", year: e.target.value })}
                    className="w-28"
                  />
                  {canEdit ? (
                    <Button size="sm" variant="primary" icon={Plus} onClick={() => setDialog({ kind: "holiday" })}>
                      Add holiday
                    </Button>
                  ) : null}
                </>
              }
            >
              <Table
                columns={holidayColumns}
                rows={holidays}
                caption={`Holidays in ${year}`}
                empty={<EmptyState icon={CalendarDays} title={`No holidays in ${year}`} description={canEdit ? "Add public holidays so they aren't counted as absences." : undefined} />}
              />
            </Card>
          )
        }
      </Tabs>

      {dialog?.kind === "type" ? (
        <LeaveTypeDialog leaveType={dialog.item} freeCodes={freeCodes} onClose={() => setDialog(null)} onSaved={saved} />
      ) : null}
      {dialog?.kind === "holiday" ? (
        <HolidayDialog holiday={dialog.item} year={year} onClose={() => setDialog(null)} onSaved={saved} />
      ) : null}
      <ConfirmDialog
        open={Boolean(confirm)}
        onClose={() => setConfirm(null)}
        onConfirm={runDelete}
        pending={pending}
        variant="danger"
        confirmLabel="Delete"
        title={confirm ? `Delete ${confirm.item.name}?` : ""}
        description={
          confirm?.kind === "type"
            ? "A leave type can only be deleted while no leave requests use it."
            : "Attendance and leave will count this date as a normal day again."
        }
      />
    </>
  );
}
