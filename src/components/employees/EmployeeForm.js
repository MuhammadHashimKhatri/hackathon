"use client";

import { useState, useTransition } from "react";
import { Save, UserPlus } from "lucide-react";
import {
  EDITABLE_STATUSES,
  GENDER_LABELS,
  GENDERS,
  registerEmployeeSchema,
  STATUS_LABELS,
  updateEmployeeSchema,
} from "@/lib/validation/employees";
import { fieldErrorsOf } from "@/lib/validation/auth";
import { formStateFromError, patchJson, postJson } from "@/lib/api";
import Button from "@/components/ui/Button";
import DatePicker from "@/components/ui/DatePicker";
import FormAlert from "@/components/ui/FormAlert";
import Input from "@/components/ui/Input";
import Select from "@/components/ui/Select";
import Textarea from "@/components/ui/Textarea";
import SalaryPreview from "./SalaryPreview";

const genderOptions = GENDERS.map((g) => ({ value: g, label: GENDER_LABELS[g] }));
const statusOptions = EDITABLE_STATUSES.map((s) => ({ value: s, label: STATUS_LABELS[s] }));

function Section({ title, description, children }) {
  return (
    <fieldset className="grid gap-4 border-t border-line pt-5 first:border-t-0 first:pt-0 sm:grid-cols-2">
      <legend className="contents">
        <span className="sm:col-span-2">
          <span className="block text-sm font-semibold text-ink">{title}</span>
          {description ? <span className="mt-0.5 block text-[0.8125rem] text-muted">{description}</span> : null}
        </span>
      </legend>
      {children}
    </fieldset>
  );
}

// Register (HR, with email + basic salary) or edit (HR, job fields only).
// onSubmit instead of a form action so a failed check keeps everything typed.
export default function EmployeeForm({ employee, departments, designations, today, onSaved, onCancel }) {
  const editing = Boolean(employee);
  const [departmentId, setDepartmentId] = useState(employee?.departmentId ?? "");
  const [basicText, setBasicText] = useState("");
  const [state, setState] = useState({});
  const [pending, startTransition] = useTransition();
  const errors = state.fieldErrors ?? {};

  const designationOptions = designations
    .filter((d) => d.departmentId === departmentId || d.departmentId === null)
    .map((d) => ({ value: d.id, label: d.departmentId ? d.title : `${d.title} (any department)` }));

  function onSubmit(e) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const text = (key) => String(form.get(key) ?? "");
    const fields = {
      fullName: text("fullName"),
      phone: text("phone"),
      address: text("address"),
      gender: text("gender") || null,
      dateOfBirth: text("dateOfBirth") || null,
      departmentId: text("departmentId"),
      designationId: text("designationId") || null,
      joinDate: text("joinDate"),
      status: text("status") || undefined, // absent for exited employees
    };
    const parsed = editing
      ? updateEmployeeSchema.safeParse(fields)
      : registerEmployeeSchema.safeParse({
          ...fields,
          email: text("email"),
          basic: basicText.trim() === "" ? Number.NaN : Number(basicText.replace(/,/g, "")),
        });
    if (!parsed.success) {
      setState({ fieldErrors: fieldErrorsOf(parsed.error), formError: "Check the highlighted fields." });
      return;
    }
    startTransition(async () => {
      const result = editing
        ? await patchJson(`/api/employees/${employee.id}`, parsed.data)
        : await postJson("/api/employees", parsed.data);
      if (!result.ok) {
        setState(formStateFromError(result, "Saving employees isn't available right now."));
        return;
      }
      setState({});
      onSaved(result.data);
    });
  }

  const noDepartments = departments.length === 0;

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-6">
      <FormAlert>{state.formError}</FormAlert>

      <Section title="Personal details">
        <Input label="Full name" name="fullName" required defaultValue={employee?.fullName} error={errors.fullName} autoComplete="off" className="sm:col-span-2" />
        {editing ? null : (
          <Input
            label="Work email"
            name="email"
            type="email"
            required
            autoComplete="off"
            hint="This becomes their sign-in. It can't be changed later."
            error={errors.email}
            className="sm:col-span-2"
          />
        )}
        <Input label="Phone" name="phone" type="tel" defaultValue={employee?.phone ?? ""} error={errors.phone} autoComplete="off" />
        <Select label="Gender" name="gender" placeholder="Not specified" options={genderOptions} defaultValue={employee?.gender ?? ""} error={errors.gender} />
        <DatePicker label="Date of birth" name="dateOfBirth" defaultValue={employee?.dateOfBirth ?? ""} max={today} error={errors.dateOfBirth} />
        <Textarea label="Address" name="address" rows={2} defaultValue={employee?.address ?? ""} error={errors.address} className="sm:col-span-2" />
      </Section>

      <Section title="Job">
        <Select
          label="Department"
          name="departmentId"
          required
          value={departmentId}
          onChange={(e) => setDepartmentId(e.target.value)}
          placeholder={noDepartments ? "No departments yet: ask Admin to add one" : "Choose a department"}
          disabled={noDepartments}
          options={departments.map((d) => ({ value: d.id, label: d.name }))}
          error={errors.departmentId}
        />
        <Select
          key={departmentId}
          label="Designation"
          name="designationId"
          placeholder={departmentId ? "None" : "Choose a department first"}
          disabled={!departmentId}
          options={designationOptions}
          defaultValue={employee?.departmentId === departmentId ? (employee?.designationId ?? "") : ""}
          error={errors.designationId}
        />
        <DatePicker label="Join date" name="joinDate" required defaultValue={employee?.joinDate ?? today} error={errors.joinDate} />
        {employee?.status === "exited" ? (
          <Input label="Status" name="statusLabel" value="Exited" disabled readOnly />
        ) : (
          <Select label="Status" name="status" options={statusOptions} defaultValue={employee?.status ?? "probation"} error={errors.status} />
        )}
      </Section>

      {editing ? null : (
        <Section title="Salary" description="HRA and medical are added on top of basic pay. Change it later on the Salary page.">
          <Input
            label="Basic salary per month"
            name="basic"
            inputMode="decimal"
            required
            value={basicText}
            onChange={(e) => setBasicText(e.target.value)}
            error={errors.basic}
            autoComplete="off"
          />
          <SalaryPreview basic={Number(basicText.replace(/,/g, ""))} className="self-end" />
        </Section>
      )}

      <div className="flex flex-wrap justify-end gap-2 border-t border-line pt-4">
        {onCancel ? (
          <Button onClick={onCancel} disabled={pending}>
            Cancel
          </Button>
        ) : null}
        <Button type="submit" variant="primary" loading={pending} icon={editing ? Save : UserPlus} disabled={noDepartments}>
          {editing ? "Save changes" : "Register employee"}
        </Button>
      </div>
    </form>
  );
}
