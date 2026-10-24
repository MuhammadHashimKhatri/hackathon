import { cn } from "@/lib/cn";
import Skeleton from "./Skeleton";

// value === null/undefined means "no data yet" and renders an em dash.
export default function StatCard({ label, value, hint, trend, loading = false, className }) {
  const empty = value === null || value === undefined;
  return (
    <div className={cn("flex min-w-0 flex-col gap-1 rounded-xl border border-line bg-surface p-4", className)}>
      <p className="truncate text-[0.8125rem] text-muted">{label}</p>
      {loading ? (
        <Skeleton className="my-1 h-8 w-20" />
      ) : (
        <p className={cn("figure text-[1.75rem] leading-9 font-semibold tracking-tight", empty ? "text-muted" : "text-ink")}>
          {empty ? "—" : value}
        </p>
      )}
      {trend ? <p className="text-[0.8125rem] text-ink">{trend}</p> : null}
      {hint ? <p className="text-[0.8125rem] text-muted">{hint}</p> : null}
    </div>
  );
}
