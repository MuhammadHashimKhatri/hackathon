"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";
import Button from "./Button";
import Dialog from "./Dialog";

// The only time a temporary password is ever shown. grant: { email, tempPassword } or null.
export default function TempPasswordDialog({
  grant,
  onClose,
  title = "Temporary password",
  description = "Share it with the user privately. It won't be shown again; they'll be asked to change it when they sign in.",
  footer,
}) {
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
      title={title}
      description={description}
      footer={footer ?? <Button variant="primary" onClick={onClose}>Done</Button>}
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
