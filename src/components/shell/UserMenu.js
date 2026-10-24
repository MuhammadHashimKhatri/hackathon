"use client";

import { useTransition } from "react";
import { Check, LogOut } from "lucide-react";
import { cn } from "@/lib/cn";
import { ROLES, ROLE_LABELS } from "@/config/navigation";
import { logout } from "@/app/actions/auth";
import { setPreviewRole } from "@/app/actions/preview";
import ThemeToggle from "./ThemeToggle";

export default function UserMenu({ role, email }) {
  const [pending, startTransition] = useTransition();
  const roleLabel = ROLE_LABELS[role] ?? role;

  return (
    <>
      <button
        type="button"
        popoverTarget="user-menu-popover"
        aria-label={`Account menu, ${roleLabel}`}
        className="flex h-9 items-center gap-2 rounded-full border border-line bg-surface pr-1 pl-1 text-sm sm:pr-3 hover:bg-surface-2"
      >
        <span className="flex size-7 items-center justify-center rounded-full bg-accent-soft text-xs font-semibold text-accent">
          {(email ?? roleLabel).charAt(0).toUpperCase()}
        </span>
        <span className="hidden font-medium sm:inline">{roleLabel}</span>
      </button>

      <div
        id="user-menu-popover"
        popover="auto"
        className="fixed inset-auto top-14 right-3 m-0 w-[min(18rem,calc(100vw-1.5rem))] rounded-xl border border-line bg-surface p-0 text-ink shadow-xl"
      >
        <div className="border-b border-line px-4 py-3">
          <p className="truncate text-sm font-medium">{email ?? "Not signed in"}</p>
          <p className="text-[0.8125rem] text-muted">{roleLabel}</p>
        </div>

        {/* TEMP (Prompt 1): role preview until real sessions exist (Prompt 3). */}
        <div className="border-b border-line px-2 py-2">
          <p className="px-2 pb-1 text-[0.8125rem] text-muted">Preview as</p>
          {ROLES.map((r) => (
            <button
              key={r}
              type="button"
              disabled={pending}
              onClick={() => startTransition(() => setPreviewRole(r))}
              className={cn(
                "flex w-full items-center justify-between rounded-md px-2 py-1.5 text-sm hover:bg-surface-2 disabled:opacity-60",
                r === role && "font-medium"
              )}
            >
              {ROLE_LABELS[r]}
              {r === role ? <Check size={16} className="text-accent" aria-hidden /> : null}
            </button>
          ))}
        </div>

        <div className="flex items-center justify-between border-b border-line px-4 py-2.5">
          <span className="text-sm">Theme</span>
          <ThemeToggle />
        </div>

        <form action={logout} className="p-2">
          <button type="submit" className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm text-danger hover:bg-surface-2">
            <LogOut size={16} aria-hidden />
            Log out
          </button>
        </form>
      </div>
    </>
  );
}
