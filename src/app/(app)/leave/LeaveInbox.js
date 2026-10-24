"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CalendarCheck, Check, X } from "lucide-react";
import { leaveDecisionSchema } from "@/lib/validation/leave";
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

const dayWord = (n) => `${n} ${n === 1 ? "day" : "days"}`;
const dates = (r) => (r.startDate === r.endDate ? formatDate(r.startDate) : `${formatDate(r.startDate)} to ${formatDate(r.endDate)}`);

// "8 of 10 left after this" for quota types; nothing for unlimited ones.
function BalanceLine({ request }) {
  const b = request.balance;
  if (!b) return null;
  if (b.quota === null) return <p className="text-[0.8125rem] text-muted">{request.typeName}: no limit</p>;
  const after = b.quota - b.approved - request.days;
  return (
    <p className={after < 0 ? "text-[0.8125rem] text-danger" : "text-[0.8125rem] text-muted"}>
      {request.typeName}: <span className="figure">{b.quota - b.approved}</span> of {b.quota} left,{" "}
      <span className="figure">{after}</span> after approving
    </p>
  );
}

function DecisionDialog({ request, decision, onClose, onDone }) {
  const [state, setState] = useState({});
  const [pending, startTransition] = useTransition();
  const approve = decision === "approve";

  function onSubmit(e) {
    e.preventDefault();
    const parsed = leaveDecisionSchema.safeParse({ decision, comment: String(new FormData(e.currentTarget).get("comment") ?? "") });
    if (!parsed.success) {
      setState({ fieldErrors: fieldErrorsOf(parsed.error) });
      return;
    }
    startTransition(async () => {
      const result = await postJson(`/api/leave/${request.id}/decision`, parsed.data);
      if (!result.ok) {
        setState(formStateFromError(result, "Deciding leave isn't available right now."));
        return;
      }
      onDone(result.data.request);
    });
  }

  return (
    <Dialog
      open
      onClose={onClose}
      size="sm"
      title={`${approve ? "Approve" : "Reject"} ${request.employeeName}'s leave?`}
      description={`${request.typeName}, ${dates(request)} (${dayWord(request.days)}). The employee gets a notification.`}
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

export default function LeaveInbox({ requests, status, canDecide, myEmployeeId }) {
  const router = useRouter();
  const { toast } = useToast();
  const [deciding, setDeciding] = useState(null); // { request, decision }

  if (requests.length === 0) {
    return (
      <Card>
        <EmptyState
          icon={CalendarCheck}
          title={status === "pending" ? "Nothing waiting" : "No decisions yet"}
          description={status === "pending" ? "When an employee applies for leave, the request waits here." : "Approved, rejected and cancelled requests appear here."}
        />
      </Card>
    );
  }

  return (
    <>
      <ul className="grid gap-3 lg:grid-cols-2">
        {requests.map((r) => {
          const own = Boolean(myEmployeeId) && r.employeeId === myEmployeeId;
          return (
            <li key={r.id}>
              <Card>
                <div className="flex flex-col gap-3">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0">
                      <Link href={`/employees/${r.employeeId}`} className="font-semibold hover:text-accent hover:underline">
                        {r.employeeName}
                      </Link>
                      <p className="text-[0.8125rem] text-muted">
                        <span className="figure">{r.employeeCode}</span>
                        {r.departmentName ? `, ${r.departmentName}` : ""}
                      </p>
                    </div>
                    <Badge status={r.status} />
                  </div>
                  <dl className="grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <dt className="text-[0.8125rem] text-muted">Type</dt>
                      <dd className="font-medium">{r.typeName}</dd>
                    </div>
                    <div>
                      <dt className="text-[0.8125rem] text-muted">Dates</dt>
                      <dd>
                        {dates(r)} <span className="figure text-muted">({dayWord(r.days)})</span>
                      </dd>
                    </div>
                  </dl>
                  {r.reason ? <p className="rounded-lg bg-surface-2 px-3 py-2 text-sm">{r.reason}</p> : null}
                  <BalanceLine request={r} />
                  {r.reviewComment ? <p className="text-[0.8125rem] text-muted">HR: {r.reviewComment}</p> : null}
                  {canDecide && r.status === "pending" ? (
                    own ? (
                      <p className="text-[0.8125rem] text-muted">Your own request: another HR user decides it.</p>
                    ) : (
                      <div className="flex justify-end gap-2">
                        <Button size="sm" variant="danger-ghost" icon={X} onClick={() => setDeciding({ request: r, decision: "reject" })}>
                          Reject
                        </Button>
                        <Button size="sm" variant="primary" icon={Check} onClick={() => setDeciding({ request: r, decision: "approve" })}>
                          Approve
                        </Button>
                      </div>
                    )
                  ) : null}
                </div>
              </Card>
            </li>
          );
        })}
      </ul>
      {deciding ? (
        <DecisionDialog
          request={deciding.request}
          decision={deciding.decision}
          onClose={() => setDeciding(null)}
          onDone={(r) => {
            setDeciding(null);
            toast({ tone: "success", title: r.status === "approved" ? "Leave approved" : "Leave rejected", description: `${r.employeeName}, ${dates(r)}` });
            router.refresh();
          }}
        />
      ) : null}
    </>
  );
}
