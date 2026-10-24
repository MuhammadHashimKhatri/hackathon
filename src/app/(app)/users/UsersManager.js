"use client";

import { useActionState, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Copy, KeyRound, UserCog, UserPlus } from "lucide-react";
import { ROLE_LABELS } from "@/config/navigation";
import { createHrUserSchema, fieldErrorsOf } from "@/lib/validation/auth";
import { formStateFromError, patchJson, postJson } from "@/lib/api";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import Dialog from "@/components/ui/Dialog";
import EmptyState from "@/components/ui/EmptyState";
import FormAlert from "@/components/ui/FormAlert";
import Input from "@/components/ui/Input";
import PageHeader from "@/components/ui/PageHeader";
import Table from "@/components/ui/Table";
import { useToast } from "@/components/ui/Toast";

const ROLE_TONE = { admin: "accent", hr: "info", employee: "neutral" };
const dateFormat = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric" });

function CreateHrDialog({ open, onClose, onCreated }) {
  const [state, formAction, pending] = useActionState(async (_prev, formData) => {
    const parsed = createHrUserSchema.safeParse({ email: formData.get("email") });
    if (!parsed.success) return { fieldErrors: fieldErrorsOf(parsed.error) };
    const result = await postJson("/api/users", parsed.data);
    if (!result.ok) return formStateFromError(result, "Creating logins isn't available right now.");
    onCreated(result.data);
    return {};
  }, {});
  const errors = state.fieldErrors ?? {};

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Create HR login"
      description="HR can register employees, run payroll drafts and approve leave. They choose their own password on first sign-in."
    >
      <form action={formAction} noValidate className="flex flex-col gap-4">
        <FormAlert>{state.formError}</FormAlert>
        <Input label="Work email" name="email" type="email" autoComplete="off" required autoFocus error={errors.email} />
        <div className="flex justify-end gap-2">
          <Button onClick={onClose} disabled={pending}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" loading={pending} icon={UserPlus}>
            Create login
          </Button>
        </div>
      </form>
    </Dialog>
  );
}

// The only time a temporary password is ever shown.
function TempPasswordDialog({ grant, onClose }) {
  const [copied, setCopied] = useState(false);
  async function copy() {
    try {
      await navigator.clipboard.writeText(grant.tempPassword);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  }
  return (
    <Dialog
      open={Boolean(grant)}
      onClose={onClose}
      title="Temporary password"
      description="Share it with the user privately. It won't be shown again; they'll be asked to change it when they sign in."
      footer={<Button variant="primary" onClick={onClose}>Done</Button>}
    >
      {grant ? (
        <div className="flex flex-col gap-3">
          <p className="text-sm">
            For <span className="font-medium">{grant.email}</span>
          </p>
          <div className="flex items-center gap-2 rounded-lg border border-line bg-surface-2 p-3">
            <code className="figure min-w-0 flex-1 text-base font-semibold tracking-wide break-all">{grant.tempPassword}</code>
            <Button size="sm" icon={copied ? Check : Copy} onClick={copy}>
              {copied ? "Copied" : "Copy"}
            </Button>
          </div>
        </div>
      ) : null}
    </Dialog>
  );
}

function ConfirmUserAction({ action, onClose, onConfirm, pending }) {
  if (!action) return <ConfirmDialog open={false} onClose={onClose} title="" />;
  const copy = {
    deactivate: {
      title: "Deactivate this login?",
      description: `${action.user.email} will be signed out and can't sign in until you activate the login again.`,
      button: "Deactivate",
      variant: "danger",
    },
    activate: {
      title: "Activate this login?",
      description: `${action.user.email} will be able to sign in again.`,
      button: "Activate",
      variant: "primary",
    },
    reset: {
      title: "Reset password?",
      description: `${action.user.email} gets a new temporary password and must change it at next sign-in.`,
      button: "Reset password",
      variant: "primary",
    },
  }[action.type];
  return (
    <ConfirmDialog
      open
      onClose={onClose}
      onConfirm={onConfirm}
      pending={pending}
      title={copy.title}
      description={copy.description}
      confirmLabel={copy.button}
      variant={copy.variant}
    />
  );
}

export default function UsersManager({ users, currentUserId }) {
  const router = useRouter();
  const { toast } = useToast();
  const [creating, setCreating] = useState(false);
  const [grant, setGrant] = useState(null);
  const [action, setAction] = useState(null);
  const [pending, startTransition] = useTransition();

  const hasHr = users.some((u) => u.role === "hr");

  function onCreated({ user, tempPassword }) {
    setCreating(false);
    setGrant({ email: user.email, tempPassword });
    router.refresh();
  }

  function runAction() {
    const { type, user } = action;
    startTransition(async () => {
      const result =
        type === "reset"
          ? await postJson(`/api/users/${user.id}/reset-password`)
          : await patchJson(`/api/users/${user.id}`, { isActive: type === "activate" });
      setAction(null);
      if (!result.ok) {
        toast({ title: "That didn't work", description: result.error?.message ?? "Try again.", tone: "danger" });
        return;
      }
      if (type === "reset") setGrant({ email: user.email, tempPassword: result.data.tempPassword });
      else toast({ title: type === "activate" ? "Login activated" : "Login deactivated", tone: "success" });
      router.refresh();
    });
  }

  const columns = [
    {
      key: "email",
      header: "Email",
      render: (u) => (
        <span className="font-medium break-all">
          {u.email}
          {u.id === currentUserId ? <span className="ml-2 text-[0.8125rem] font-normal text-muted">(you)</span> : null}
        </span>
      ),
    },
    { key: "role", header: "Role", render: (u) => <Badge tone={ROLE_TONE[u.role]}>{ROLE_LABELS[u.role]}</Badge> },
    {
      key: "status",
      header: "Status",
      render: (u) => (
        <span className="inline-flex flex-wrap justify-end gap-1.5 md:justify-start">
          {u.isActive ? <Badge tone="success">Active</Badge> : <Badge tone="neutral">Deactivated</Badge>}
          {u.isActive && u.mustChangePassword ? <Badge tone="warning">Temporary password</Badge> : null}
        </span>
      ),
    },
    { key: "createdAt", header: "Created", render: (u) => dateFormat.format(new Date(u.createdAt)) },
    {
      key: "actions",
      header: <span className="sr-only">Actions</span>,
      mobileLabel: "Actions",
      align: "right",
      render: (u) =>
        u.id === currentUserId ? (
          <span className="text-muted" aria-label="No actions for your own login">—</span>
        ) : (
          <span className="inline-flex flex-wrap justify-end gap-2">
            <Button size="sm" icon={KeyRound} onClick={() => setAction({ type: "reset", user: u })} disabled={!u.isActive}>
              Reset password
            </Button>
            {u.isActive ? (
              <Button size="sm" variant="danger-ghost" onClick={() => setAction({ type: "deactivate", user: u })}>
                Deactivate
              </Button>
            ) : (
              <Button size="sm" variant="ghost" onClick={() => setAction({ type: "activate", user: u })}>
                Activate
              </Button>
            )}
          </span>
        ),
    },
  ];

  return (
    <>
      <PageHeader
        title="Users"
        description="Sign-in accounts for Admin and HR. Employee logins are created when HR registers an employee."
        actions={
          <Button variant="primary" icon={UserPlus} onClick={() => setCreating(true)}>
            Create HR login
          </Button>
        }
      />

      <Card padding={false}>
        <div className="p-2 sm:p-3">
          <Table columns={columns} rows={users} caption="Logins" />
        </div>
        {hasHr ? null : (
          <div className="border-t border-line">
            <EmptyState
              compact
              icon={UserCog}
              title="No HR logins yet"
              description="Create one so HR can start registering employees."
            />
          </div>
        )}
      </Card>

      {creating ? <CreateHrDialog open onClose={() => setCreating(false)} onCreated={onCreated} /> : null}
      <TempPasswordDialog grant={grant} onClose={() => setGrant(null)} />
      <ConfirmUserAction action={action} onClose={() => setAction(null)} onConfirm={runAction} pending={pending} />
    </>
  );
}
