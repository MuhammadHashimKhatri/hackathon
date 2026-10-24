"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, Check, ClipboardCheck, X } from "lucide-react";
import { correctionDecisionSchema } from "@/lib/validation/attendance";
import { fieldErrorsOf } from "@/lib/validation/auth";
import { formStateFromError, postJson } from "@/lib/api";
import { formatDate } from "@/lib/format";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import Dialog from "@/components/ui/Dialog";
import EmptyState from "@/components/ui/EmptyState";
import FormAlert from "@/components/ui/FormAlert";
import Textarea from "@/components/ui/Textarea";
import { useToast } from "@/components/ui/Toast";

function TimeChange({ label, from, to }) {
  return (
    <div>
      <dt className="text-[0.8125rem] text-muted">{label}</dt>
      <dd className="figure flex items-center gap-1.5 text-sm">
        {to ? (
          <>
            <span className="text-muted line-through decoration-1">{from ?? "none"}</span>
            <ArrowRight size={14} className="text-muted" aria-label="changes to" />
            <span className="font-semibold">{to}</span>
          </>
        ) : (
          <span>{from ?? "—"} (unchanged)</span>
        )}
      </dd>
    </div>
  );
}

function DecisionDialog({ request, decision, onClose, onDone }) {
  const [state, setState] = useState({});
  const [pending, startTransition] = useTransition();
  const approve = decision === "approve";

  function onSubmit(e) {
    e.preventDefault();
    const parsed = correctionDecisionSchema.safeParse({ decision, comment: String(new FormData(e.currentTarget).get("comment") ?? "") });
    if (!parsed.success) {
      setState({ fieldErrors: fieldErrorsOf(parsed.error) });
      return;
    }
    startTransition(async () => {
      const result = await postJson(`/api/attendance/corrections/${request.id}/decision`, parsed.data);
      if (!result.ok) {
        setState(formStateFromError(result, "Deciding corrections isn't available right now."));
        return;
      }
      onDone(result.data.correction);
    });
  }

  return (
    <Dialog
      open
      onClose={onClose}
      size="sm"
      title={`${approve ? "Approve" : "Reject"} ${request.employeeName}'s correction?`}
      description={
        approve
          ? `${formatDate(request.workDate)} is rewritten with the requested times and its status is recalculated.`
          : "The day stays as it is. Tell the employee why."
      }
    >
      <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
        <FormAlert>{state.formError}</FormAlert>
        <Textarea
          label={approve ? "Comment (optional)" : "Reason"}
          name="comment"
          rows={3}
          required={!approve}
          autoFocus
          error={state.fieldErrors?.comment}
        />
        <div className="flex justify-end gap-2">
          <Button onClick={onClose} disabled={pending}>
            Cancel
          </Button>
          <Button type="submit" variant={approve ? "primary" : "danger"} icon={approve ? Check : X} loading={pending}>
            {approve ? "Approve" : "Reject"}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}

export default function CorrectionsInbox({ corrections, status, canDecide }) {
  const router = useRouter();
  const { toast } = useToast();
  const [deciding, setDeciding] = useState(null); // { request, decision }

  if (corrections.length === 0) {
    return (
      <Card>
        <EmptyState
          icon={ClipboardCheck}
          title={status === "pending" ? "Nothing waiting" : "No decisions yet"}
          description={
            status === "pending"
              ? "When an employee asks to fix a day, the request waits here."
              : "Approved and rejected requests appear here."
          }
        />
      </Card>
    );
  }

  return (
    <>
      <ul className="grid gap-3 lg:grid-cols-2">
        {corrections.map((c) => (
          <li key={c.id}>
            <Card>
              <div className="flex flex-col gap-3">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <Link href={`/employees/${c.employeeId}`} className="font-semibold hover:text-accent hover:underline">
                      {c.employeeName}
                    </Link>
                    <p className="text-[0.8125rem] text-muted">
                      <span className="figure">{c.employeeCode}</span>, {formatDate(c.workDate)}
                    </p>
                  </div>
                  {c.status === "pending" ? (c.currentStatus ? <Badge status={c.currentStatus} /> : <Badge tone="neutral">No record</Badge>) : <Badge status={c.status} />}
                </div>
                <dl className="grid grid-cols-2 gap-3">
                  <TimeChange label="Check-in" from={c.currentCheckIn} to={c.requestedCheckIn} />
                  <TimeChange label="Check-out" from={c.currentCheckOut} to={c.requestedCheckOut} />
                </dl>
                <p className="rounded-lg bg-surface-2 px-3 py-2 text-sm">{c.reason}</p>
                {c.reviewComment ? <p className="text-[0.8125rem] text-muted">HR: {c.reviewComment}</p> : null}
                {canDecide && c.status === "pending" ? (
                  <div className="flex justify-end gap-2">
                    <Button size="sm" variant="danger-ghost" icon={X} onClick={() => setDeciding({ request: c, decision: "reject" })}>
                      Reject
                    </Button>
                    <Button size="sm" variant="primary" icon={Check} onClick={() => setDeciding({ request: c, decision: "approve" })}>
                      Approve
                    </Button>
                  </div>
                ) : null}
              </div>
            </Card>
          </li>
        ))}
      </ul>
      {deciding ? (
        <DecisionDialog
          request={deciding.request}
          decision={deciding.decision}
          onClose={() => setDeciding(null)}
          onDone={(c) => {
            setDeciding(null);
            toast({ tone: "success", title: c.status === "approved" ? "Correction approved" : "Correction rejected", description: `${c.employeeName}, ${formatDate(c.workDate)}` });
            router.refresh();
          }}
        />
      ) : null}
    </>
  );
}
