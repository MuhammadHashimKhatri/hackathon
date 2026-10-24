"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Bell } from "lucide-react";
import EmptyState from "@/components/ui/EmptyState";
import { buttonClass } from "@/components/ui/Button";
import { postJson } from "@/lib/api";
import { cn } from "@/lib/cn";

const time = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

// Own notifications (Spec §4 row 24). Native popover: light-dismiss and Esc for free.
// The unread count refreshes every minute and whenever the popover opens.
export default function NotificationsBell() {
  const [data, setData] = useState({ items: [], unread: 0 });

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/notifications", { cache: "no-store" });
      if (res.ok) setData(await res.json());
    } catch {
      // offline: keep the last list
    }
  }, []);

  useEffect(() => {
    const first = setTimeout(load, 0);
    const timer = setInterval(load, 60_000);
    return () => {
      clearTimeout(first);
      clearInterval(timer);
    };
  }, [load]);

  async function markAll() {
    const result = await postJson("/api/notifications/read", {});
    if (result.ok) setData(result.data);
  }

  async function open(n) {
    if (!n.readAt) {
      const result = await postJson("/api/notifications/read", { ids: [n.id] });
      if (result.ok) setData(result.data);
    }
    document.getElementById("notifications-popover")?.hidePopover?.();
  }

  return (
    <>
      <button
        type="button"
        popoverTarget="notifications-popover"
        aria-label={data.unread ? `Notifications, ${data.unread} unread` : "Notifications"}
        onClick={load}
        className={cn(buttonClass({ variant: "ghost", size: "icon" }), "relative")}
      >
        <Bell size={18} aria-hidden />
        {data.unread ? (
          <span className="figure absolute -top-0.5 -right-0.5 grid min-w-4 place-items-center rounded-full bg-danger px-1 text-[0.625rem] leading-4 font-semibold text-white">
            {data.unread > 9 ? "9+" : data.unread}
          </span>
        ) : null}
      </button>
      <div
        id="notifications-popover"
        popover="auto"
        className="fixed inset-auto top-14 right-3 m-0 w-[min(22rem,calc(100vw-1.5rem))] rounded-xl border border-line bg-surface p-0 text-ink shadow-xl"
      >
        <div className="flex items-center justify-between border-b border-line px-4 py-3">
          <p className="text-sm font-semibold">Notifications</p>
          {data.unread ? (
            <button type="button" onClick={markAll} className="text-[0.8125rem] font-medium text-accent hover:underline">
              Mark all read
            </button>
          ) : null}
        </div>
        {data.items.length === 0 ? (
          <EmptyState compact icon={Bell} title="You're all caught up" description="Leave decisions, payslips and announcements will show up here." />
        ) : (
          <ul className="max-h-[min(24rem,70dvh)] divide-y divide-line overflow-y-auto">
            {data.items.map((n) => (
              <li key={n.id}>
                <Link
                  href={n.link ?? "/dashboard"}
                  onClick={() => open(n)}
                  className={cn("flex gap-2 px-4 py-3 hover:bg-surface-2", !n.readAt && "bg-accent-soft/40")}
                >
                  <span className={cn("mt-1.5 size-2 shrink-0 rounded-full", n.readAt ? "bg-transparent" : "bg-accent")} aria-hidden />
                  <span className="min-w-0">
                    <span className="block text-sm font-medium">{n.title}</span>
                    {n.body ? <span className="line-clamp-2 block text-[0.8125rem] text-muted">{n.body}</span> : null}
                    <span className="block text-[0.75rem] text-muted">{time.format(new Date(n.createdAt))}</span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </>
  );
}
