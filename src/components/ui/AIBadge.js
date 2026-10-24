import { Sparkles } from "lucide-react";
import { cn } from "@/lib/cn";

export default function AIBadge({ size = "sm", className }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full bg-accent-soft font-medium text-accent",
        size === "sm" ? "px-2 py-0.5 text-xs" : "px-2.5 py-1 text-[0.8125rem]",
        className
      )}
    >
      <Sparkles size={size === "sm" ? 12 : 14} aria-hidden />
      AI-generated
    </span>
  );
}
