"use client";

import Link from "next/link";
import { KeyRound, LogOut } from "lucide-react";
import { ROLE_LABELS } from "@/config/navigation";
import ThemeToggle from "./ThemeToggle";

export default function UserMenu({ role, email }) {
  const roleLabel = ROLE_LABELS[role] ?? role;

  return (
    <>
      <button
        type="button"
        popoverTarget="user-menu-popover"
        aria-label={`Account menu, ${email}, ${roleLabel}`}
        className="flex h-9 items-center gap-2 rounded-full border border-line bg-surface pr-1 pl-1 text-sm hover:bg-surface-2 sm:pr-3"
      >
        <span className="flex size-7 items-center justify-center rounded-full bg-accent-soft text-xs font-semibold text-accent">
          {email.charAt(0).toUpperCase()}
        </span>
        <span className="hidden font-medium sm:inline">{roleLabel}</span>
      </button>

      <div
        id="user-menu-popover"
        popover="auto"
        className="fixed inset-auto top-14 right-3 m-0 w-[min(18rem,calc(100vw-1.5rem))] rounded-xl border border-line bg-surface p-0 text-ink shadow-xl"
      >
        <div className="border-b border-line px-4 py-3">
          <p className="truncate text-sm font-medium">{email}</p>
          <p className="text-[0.8125rem] text-muted">{roleLabel}</p>
        </div>

        <div className="flex items-center justify-between border-b border-line px-4 py-2.5">
          <span className="text-sm">Theme</span>
          <ThemeToggle />
        </div>

        <div className="p-2">
          <Link
            href="/change-password"
            className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-surface-2"
          >
            <KeyRound size={16} aria-hidden />
            Change password
          </Link>
          <form action="/api/auth/logout" method="post">
            <button type="submit" className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm text-danger hover:bg-surface-2">
              <LogOut size={16} aria-hidden />
              Log out
            </button>
          </form>
        </div>
      </div>
    </>
  );
}
