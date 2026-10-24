"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/cn";
import { NAV, activeHref } from "@/config/navigation";
import { useShell } from "./ShellContext";

export default function NavLinks({ role }) {
  const pathname = usePathname();
  const { closeNav } = useShell();
  const items = NAV[role] ?? [];
  const current = activeHref(items, pathname);

  return (
    <ul className="flex flex-col gap-0.5 p-3">
      {items.map(({ label, href, icon: Icon }) => {
        const active = href === current;
        return (
          <li key={href}>
            <Link
              href={href}
              onClick={closeNav}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors",
                active ? "bg-accent-soft font-medium text-accent" : "text-muted hover:bg-surface-2 hover:text-ink"
              )}
            >
              <Icon size={18} aria-hidden className="shrink-0" />
              <span className="leading-snug">{label}</span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
