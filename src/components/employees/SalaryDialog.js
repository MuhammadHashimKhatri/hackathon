"use client";

import { useState, useTransition } from "react";
import { Banknote } from "lucide-react";
import { salarySchema } from "@/lib/validation/employees";
import { fieldErrorsOf } from "@/lib/validation/auth";
import { formStateFromError, postJson } from "@/lib/api";
import Button from "@/components/ui/Button";
import DatePicker from "@/components/ui/DatePicker";
import Dialog from "@/components/ui/Dialog";
import FormAlert from "@/components/ui/FormAlert";
import Input from "@/components/ui/Input";
import SalaryPreview from "./SalaryPreview";

// HR sets a new basic salary from a date. employee: { id, fullName, joinDate }.
export default function SalaryDialog({ employee, today, onClose, onSaved }) {
  const [basicText, setBasicText] = useState("");
  const [state, setState] = useState({});
  const [pending, startTransition] = useTransition();
  const errors = state.fieldErrors ?? {};
  const defaultFrom = today < employee.joinDate ? employee.joinDate : today;

  function onSubmit(e) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const parsed = salarySchema.safeParse({
      basic: basicText.trim() === "" ? Number.NaN : Number(basicText.replace(/,/g, "")),
      effectiveFrom: String(form.get("effectiveFrom") ?? ""),
    });
    if (!parsed.success) {
      setState({ fieldErrors: fieldErrorsOf(parsed.error) });
      return;
    }
    startTransition(async () => {
      const result = await postJson(`/api/employees/${employee.id}/salary`, parsed.data);
      if (!result.ok) {
        setState(formStateFromError(result, "Saving salaries isn't available right now."));
        return;
      }
      onSaved(result.data.salary);
    });
  }

  return (
    <Dialog
      open
      onClose={onClose}
      title={`Set salary for ${employee.fullName}`}
      description="Applies from the chosen date. Payroll for earlier months keeps the old amount. Saving again for the same date replaces it."
    >
      <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
        <FormAlert>{state.formError}</FormAlert>
        <div className="grid gap-4 sm:grid-cols-2">
          <Input
            label="Basic salary per month"
            name="basic"
            inputMode="decimal"
            required
            autoFocus
            value={basicText}
            onChange={(e) => setBasicText(e.target.value)}
            error={errors.basic}
            autoComplete="off"
          />
          <DatePicker
            label="Effective from"
            name="effectiveFrom"
            required
            min={employee.joinDate}
            defaultValue={defaultFrom}
            error={errors.effectiveFrom}
          />
        </div>
        <SalaryPreview basic={Number(basicText.replace(/,/g, ""))} />
        <div className="flex justify-end gap-2">
          <Button onClick={onClose} disabled={pending}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" loading={pending} icon={Banknote}>
            Save salary
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
