import { cn } from "@/lib/cn";

const tones = {
  success: "bg-success-soft text-success",
  warning: "bg-warning-soft text-warning",
  caution: "bg-caution-soft text-caution",
  danger: "bg-danger-soft text-danger",
  info: "bg-info-soft text-info",
  neutral: "bg-neutral-soft text-neutral",
  accent: "bg-accent-soft text-accent",
};

// One place that decides how every status in the app looks.
export const STATUS = {
  present: { tone: "success", label: "Present" },
  late: { tone: "warning", label: "Late" },
  half_day: { tone: "caution", label: "Half day" },
  absent: { tone: "danger", label: "Absent" },
  on_leave: { tone: "info", label: "On leave" },
  missing_checkout: { tone: "neutral", label: "Missing check-out" },
  not_in_yet: { tone: "neutral", label: "Not checked in yet" },
  off_day: { tone: "neutral", label: "Off day" },
  pending: { tone: "warning", label: "Pending" },
  approved: { tone: "success", label: "Approved" },
  rejected: { tone: "danger", label: "Rejected" },
  cancelled: { tone: "neutral", label: "Cancelled" },
  probation: { tone: "warning", label: "Probation" },
  active: { tone: "success", label: "Active" },
  exited: { tone: "neutral", label: "Exited" },
  draft: { tone: "warning", label: "Draft" },
  finalized: { tone: "success", label: "Finalized" },
};

export default function Badge({ status, tone, children, className }) {
  const meta = status ? STATUS[status] : null;
  const resolvedTone = tone ?? meta?.tone ?? "neutral";
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap",
        tones[resolvedTone],
        className
      )}
    >
      <span aria-hidden className="size-1.5 rounded-full bg-current" />
      {children ?? meta?.label ?? status}
    </span>
  );
}
