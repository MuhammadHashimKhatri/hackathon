"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Eye } from "lucide-react";
import { cn } from "@/lib/cn";

// Short labels keep all three tabs visible at 375px.
const TABS = [
  { href: "/settings/company", label: "Company", short: "Company" },
  { href: "/settings/organization", label: "Departments & designations", short: "Departments" },
  { href: "/settings/leave", label: "Leave types & holidays", short: "Leave & holidays" },
];

// Shared by Admin (editable) and HR (readOnly) on the three settings pages.
export default function SettingsTabs({ readOnly = false }) {
  const pathname = usePathname();
  return (
    <div className="mb-6 flex flex-col gap-3 border-b border-line sm:flex-row sm:items-end sm:justify-between">
      <nav aria-label="Company setup" className="-mb-px flex gap-1 overflow-x-auto">
        {TABS.map((tab) => {
          const active = pathname === tab.href;
          return (
            <Link
              key={tab.href}
              href={tab.href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "border-b-2 px-2.5 py-2 text-sm font-medium whitespace-nowrap transition-colors sm:px-3",
                active ? "border-accent text-ink" : "border-transparent text-muted hover:text-ink"
              )}
            >
              <span className="sm:hidden">{tab.short}</span>
              <span className="hidden sm:inline">{tab.label}</span>
            </Link>
          );
        })}
      </nav>
      {readOnly ? (
        <p className="mb-2 flex items-center gap-1.5 text-[0.8125rem] text-muted">
          <Eye size={14} aria-hidden />
          View only. Admin manages these settings.
        </p>
      ) : null}
    </div>
  );
}
