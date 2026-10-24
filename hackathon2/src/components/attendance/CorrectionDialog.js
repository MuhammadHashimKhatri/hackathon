"use client";

import { useState, useTransition } from "react";
import { Send } from "lucide-react";
import { correctionRequestSchema } from "@/lib/validation/attendance";
import { fieldErrorsOf } from "@/lib/validation/auth";
import { formStateFromError, postJson } from "@/lib/api";
import { formatDate } from "@/lib/format";
import Button from "@/components/ui/Button";
import Dialog from "@/components/ui/Dialog";
import FormAlert from "@/components/ui/FormAlert";
import Input from "@/components/ui/Input";
import Textarea from "@/components/ui/Textarea";

// Employee asks HR to fix one day. day: a calendar entry { date, checkIn, checkOut }.
export default function CorrectionDialog({ day, onClose, onSent }) {
  const [state, setState] = useState({});
  const [pending, startTransition] = useTransition();
  const errors = state.fieldErrors ?? {};

  function onSubmit(e) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const time = (key) => String(form.get(key) ?? "") || null;
    // Only send times that change; an unchanged time stays as recorded.
    const checkIn = time("checkIn");
    const checkOut = time("checkOut");
    const parsed = correctionRequestSchema.safeParse({
      workDate: day.date,
      checkIn: checkIn !== day.checkIn ? checkIn : null,
      checkOut: checkOut !== day.checkOut ? checkOut : null,
      reason: String(form.get("reason") ?? ""),
    });
    if (!parsed.success) {
      setState({ fieldErrors: fieldErrorsOf(parsed.error) });
      return;
    }
    startTransition(async () => {
      const result = await postJson("/api/attendance/corrections", parsed.data);
      if (!result.ok) {
        setState(formStateFromError(result, "Correction requests aren't available right now."));
        return;
      }
      onSent(result.data.correction);
    });
  }

  return (
    <Dialog
      open
      onClose={onClose}
      title={`Correct ${formatDate(day.date)}`}
      description="Enter the times you actually arrived or left. HR reviews the request; your day changes only if they approve it."
    >
      <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
        <FormAlert>{state.formError}</FormAlert>
        <div className="grid grid-cols-2 gap-4">
          <Input label="Check-in" name="checkIn" type="time" defaultValue={day.checkIn ?? ""} error={errors.checkIn} />
          <Input label="Check-out" name="checkOut" type="time" defaultValue={day.checkOut ?? ""} error={errors.checkOut} />
        </div>
        <Textarea label="What happened?" name="reason" required rows={3} placeholder="For example: forgot to check out, phone battery died" error={errors.reason} />
        <div className="flex justify-end gap-2">
          <Button onClick={onClose} disabled={pending}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" icon={Send} loading={pending}>
            Send to HR
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
