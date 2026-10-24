import { Bell } from "lucide-react";
import EmptyState from "@/components/ui/EmptyState";
import { buttonClass } from "@/components/ui/Button";

// Placeholder until Prompt 11 (notifications). Uses the native popover API:
// light-dismiss and Esc work without any JavaScript.
export default function NotificationsBell() {
  return (
    <>
      <button
        type="button"
        popoverTarget="notifications-popover"
        aria-label="Notifications"
        className={buttonClass({ variant: "ghost", size: "icon" })}
      >
        <Bell size={18} aria-hidden />
      </button>
      <div
        id="notifications-popover"
        popover="auto"
        className="fixed inset-auto top-14 right-3 m-0 w-[min(22rem,calc(100vw-1.5rem))] rounded-xl border border-line bg-surface p-0 text-ink shadow-xl"
      >
        <p className="border-b border-line px-4 py-3 text-sm font-semibold">Notifications</p>
        <EmptyState
          compact
          icon={Bell}
          title="You're all caught up"
          description="Leave decisions, payslips and announcements will show up here."
        />
      </div>
    </>
  );
}
