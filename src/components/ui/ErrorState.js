import { RefreshCw, TriangleAlert } from "lucide-react";
import { cn } from "@/lib/cn";
import Button from "./Button";

export default function ErrorState({
  title = "This page didn't load",
  description = "Check your connection and try again. If it keeps happening, tell your admin.",
  onRetry,
  className,
}) {
  return (
    <div role="alert" className={cn("flex flex-col items-center gap-3 py-12 text-center", className)}>
      <span className="flex size-10 items-center justify-center rounded-full bg-danger-soft text-danger">
        <TriangleAlert size={20} aria-hidden />
      </span>
      <div className="flex max-w-sm flex-col gap-1">
        <p className="text-sm font-semibold text-ink">{title}</p>
        <p className="text-[0.8125rem] text-muted">{description}</p>
      </div>
      {onRetry ? (
        <Button icon={RefreshCw} onClick={onRetry}>
          Try again
        </Button>
      ) : null}
    </div>
  );
}
