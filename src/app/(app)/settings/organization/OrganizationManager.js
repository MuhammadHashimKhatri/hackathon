"use client";

import { useActionState, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Network, Pencil, Plus, Trash2 } from "lucide-react";
import { departmentSchema, designationSchema } from "@/lib/validation/organization";
import { fieldErrorsOf } from "@/lib/validation/auth";
import { deleteJson, formStateFromError, patchJson, postJson } from "@/lib/api";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import Dialog from "@/components/ui/Dialog";
import EmptyState from "@/components/ui/EmptyState";
import FormAlert from "@/components/ui/FormAlert";
import Input from "@/components/ui/Input";
import Select from "@/components/ui/Select";
import { useToast } from "@/components/ui/Toast";

const plural = (n, word) => `${n} ${word}${n === 1 ? "" : "s"}`;

function DepartmentDialog({ department, onClose, onSaved }) {
  const editing = Boolean(department);
  const [state, formAction, pending] = useActionState(async (_prev, formData) => {
    const parsed = departmentSchema.safeParse({ name: formData.get("name") });
    if (!parsed.success) return { fieldErrors: fieldErrorsOf(parsed.error) };
    const result = editing
      ? await patchJson(`/api/departments/${department.id}`, parsed.data)
      : await postJson("/api/departments", parsed.data);
    if (!result.ok) return formStateFromError(result, "Saving departments isn't available right now.");
    onSaved(editing ? "Department renamed" : "Department added");
    return {};
  }, {});

  return (
    <Dialog open onClose={onClose} title={editing ? "Rename department" : "Add department"}>
      <form action={formAction} noValidate className="flex flex-col gap-4">
        <FormAlert>{state.formError}</FormAlert>
        <Input
          label="Department name"
          name="name"
          placeholder="Engineering"
          defaultValue={department?.name}
          error={state.fieldErrors?.name}
          required
          autoFocus
        />
        <div className="flex justify-end gap-2">
          <Button onClick={onClose} disabled={pending}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" loading={pending}>
            {editing ? "Save name" : "Add department"}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}

function DesignationDialog({ designation, departmentId, departments, onClose, onSaved }) {
  const editing = Boolean(designation);
  const [state, formAction, pending] = useActionState(async (_prev, formData) => {
    const dept = String(formData.get("departmentId") ?? "");
    const parsed = designationSchema.safeParse({ title: formData.get("title"), departmentId: dept || null });
    if (!parsed.success) return { fieldErrors: fieldErrorsOf(parsed.error) };
    const result = editing
      ? await patchJson(`/api/designations/${designation.id}`, parsed.data)
      : await postJson("/api/designations", parsed.data);
    if (!result.ok) return formStateFromError(result, "Saving designations isn't available right now.");
    onSaved(editing ? "Designation updated" : "Designation added");
    return {};
  }, {});

  return (
    <Dialog open onClose={onClose} title={editing ? "Edit designation" : "Add designation"}>
      <form action={formAction} noValidate className="flex flex-col gap-4">
        <FormAlert>{state.formError}</FormAlert>
        <Input
          label="Title"
          name="title"
          placeholder="Software Engineer"
          defaultValue={designation?.title}
          error={state.fieldErrors?.title}
          required
          autoFocus
        />
        <Select
          label="Department"
          name="departmentId"
          placeholder="No department"
          defaultValue={designation ? designation.departmentId ?? "" : departmentId ?? ""}
          options={departments.map((d) => ({ value: d.id, label: d.name }))}
          error={state.fieldErrors?.departmentId}
        />
        <div className="flex justify-end gap-2">
          <Button onClick={onClose} disabled={pending}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" loading={pending}>
            {editing ? "Save designation" : "Add designation"}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}

function DesignationRows({ designations, canEdit, onEdit, onDelete }) {
  if (designations.length === 0) return <p className="text-[0.8125rem] text-muted">No designations yet.</p>;
  return (
    <ul className="flex flex-col divide-y divide-line">
      {designations.map((d) => (
        <li key={d.id} className="flex items-center justify-between gap-3 py-2">
          <div className="min-w-0">
            <p className="truncate text-sm text-ink">{d.title}</p>
            <p className="figure text-xs text-muted">{plural(d.employeeCount, "employee")}</p>
          </div>
          {canEdit ? (
            <div className="flex shrink-0 gap-1">
              <Button size="icon" variant="ghost" icon={Pencil} aria-label={`Edit ${d.title}`} onClick={() => onEdit(d)} />
              <Button size="icon" variant="danger-ghost" icon={Trash2} aria-label={`Delete ${d.title}`} onClick={() => onDelete(d)} />
            </div>
          ) : null}
        </li>
      ))}
    </ul>
  );
}

export default function OrganizationManager({ departments, unassignedDesignations, canEdit }) {
  const router = useRouter();
  const { toast } = useToast();
  const [dialog, setDialog] = useState(null); // { kind, department?, designation?, departmentId? }
  const [confirm, setConfirm] = useState(null); // { kind, item }
  const [pending, startTransition] = useTransition();

  const close = () => setDialog(null);
  function saved(title) {
    setDialog(null);
    toast({ title, tone: "success" });
    router.refresh();
  }

  function runDelete() {
    const { kind, item } = confirm;
    startTransition(async () => {
      const result = await deleteJson(`/api/${kind === "department" ? "departments" : "designations"}/${item.id}`);
      setConfirm(null);
      if (!result.ok) {
        toast({ title: "Not deleted", description: result.error?.message ?? "Try again.", tone: "danger" });
        return;
      }
      toast({ title: `${kind === "department" ? "Department" : "Designation"} deleted`, tone: "success" });
      router.refresh();
    });
  }

  const designationActions = {
    onEdit: (designation) => setDialog({ kind: "designation", designation }),
    onDelete: (item) => setConfirm({ kind: "designation", item }),
  };

  return (
    <>
      {canEdit ? (
        <div className="mb-4 flex flex-wrap justify-end gap-2">
          <Button icon={Plus} onClick={() => setDialog({ kind: "designation" })} disabled={departments.length === 0 && unassignedDesignations.length === 0}>
            Add designation
          </Button>
          <Button variant="primary" icon={Plus} onClick={() => setDialog({ kind: "department" })}>
            Add department
          </Button>
        </div>
      ) : null}

      {departments.length === 0 && unassignedDesignations.length === 0 ? (
        <Card>
          <EmptyState
            icon={Network}
            title="No departments yet"
            description={canEdit ? "Add your first department, for example Engineering." : "Admin hasn't added any departments yet."}
          />
        </Card>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {departments.map((dept) => (
            <Card
              key={dept.id}
              title={dept.name}
              description={`${plural(dept.employeeCount, "employee")}, ${plural(dept.designations.length, "designation")}`}
              actions={
                canEdit ? (
                  <>
                    <Button size="icon" variant="ghost" icon={Pencil} aria-label={`Rename ${dept.name}`} onClick={() => setDialog({ kind: "department", department: dept })} />
                    <Button size="icon" variant="danger-ghost" icon={Trash2} aria-label={`Delete ${dept.name}`} onClick={() => setConfirm({ kind: "department", item: dept })} />
                  </>
                ) : null
              }
            >
              <DesignationRows designations={dept.designations} canEdit={canEdit} {...designationActions} />
              {canEdit ? (
                <Button size="sm" variant="ghost" icon={Plus} className="mt-2 -ml-2" onClick={() => setDialog({ kind: "designation", departmentId: dept.id })}>
                  Add designation
                </Button>
              ) : null}
            </Card>
          ))}
          {unassignedDesignations.length ? (
            <Card title="No department" description="Designations not linked to a department.">
              <DesignationRows designations={unassignedDesignations} canEdit={canEdit} {...designationActions} />
            </Card>
          ) : null}
        </div>
      )}

      {dialog?.kind === "department" ? <DepartmentDialog department={dialog.department} onClose={close} onSaved={saved} /> : null}
      {dialog?.kind === "designation" ? (
        <DesignationDialog
          designation={dialog.designation}
          departmentId={dialog.departmentId}
          departments={departments}
          onClose={close}
          onSaved={saved}
        />
      ) : null}
      <ConfirmDialog
        open={Boolean(confirm)}
        onClose={() => setConfirm(null)}
        onConfirm={runDelete}
        pending={pending}
        variant="danger"
        confirmLabel="Delete"
        title={confirm ? `Delete ${confirm.kind === "department" ? confirm.item.name : confirm.item.title}?` : ""}
        description={
          confirm?.kind === "department"
            ? "A department can only be deleted when it has no employees and no designations."
            : "A designation can only be deleted when no employee holds it."
        }
      />
    </>
  );
}
