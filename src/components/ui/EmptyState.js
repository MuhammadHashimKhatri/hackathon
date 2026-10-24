import { Inbox } from "lucide-react";
import { cn } from "@/lib/cn";

export default function EmptyState({ icon: Icon = Inbox, title, description, action, compact = false, className }) {
  return (
    <div className={cn("flex flex-col items-center text-center", compact ? "gap-2 py-6" : "gap-3 py-12", className)}>
      <span className="flex size-10 items-center justify-center rounded-full bg-surface-2 text-muted">
        <Icon size={20} aria-hidden />
      </span>
      <div className="flex max-w-sm flex-col gap-1">
        <p className="text-sm font-semibold text-ink">{title}</p>
        {description ? <p className="text-[0.8125rem] text-muted">{description}</p> : null}
      </div>
      {action ? <div className="mt-1">{action}</div> : null}
    </div>
  );
}
