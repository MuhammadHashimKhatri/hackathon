"use client";

import { useState, useTransition } from "react";
import { exitEmployeeSchema } from "@/lib/validation/employees";
import { fieldErrorsOf } from "@/lib/validation/auth";
import { formStateFromError, postJson } from "@/lib/api";
import Button from "@/components/ui/Button";
import DatePicker from "@/components/ui/DatePicker";
import Dialog from "@/components/ui/Dialog";
import FormAlert from "@/components/ui/FormAlert";

// HR records an employee's last day. Their employee login stops working.
export default function ExitDialog({ employee, today, onClose, onDone }) {
  const [state, setState] = useState({});
  const [pending, startTransition] = useTransition();
  const errors = state.fieldErrors ?? {};

  function onSubmit(e) {
    e.preventDefault();
    const parsed = exitEmployeeSchema.safeParse({ exitDate: String(new FormData(e.currentTarget).get("exitDate") ?? "") });
    if (!parsed.success) {
      setState({ fieldErrors: fieldErrorsOf(parsed.error) });
      return;
    }
    startTransition(async () => {
      const result = await postJson(`/api/employees/${employee.id}/exit`, parsed.data);
      if (!result.ok) {
        setState(formStateFromError(result, "Recording exits isn't available right now."));
        return;
      }
      onDone(result.data);
    });
  }

  return (
    <Dialog
      open
      onClose={onClose}
      size="sm"
      title={`Exit ${employee.fullName}?`}
      description="Their status becomes Exited and their login is deactivated. Payroll stops after the last working day. This can't be undone here."
    >
      <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
        <FormAlert>{state.formError}</FormAlert>
        <DatePicker label="Last working day" name="exitDate" required min={employee.joinDate} defaultValue={today} error={errors.exitDate} />
        <div className="flex justify-end gap-2">
          <Button onClick={onClose} disabled={pending}>
            Cancel
          </Button>
          <Button type="submit" variant="danger" loading={pending}>
            Exit employee
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
