import { CircleAlert } from "lucide-react";
import { cn } from "@/lib/cn";

// Form-level message (not tied to one field). Announced to screen readers.
export default function FormAlert({ children, className }) {
  if (!children) return null;
  return (
    <div role="alert" className={cn("flex items-start gap-2 rounded-lg bg-danger-soft px-3 py-2.5 text-[0.8125rem] text-danger", className)}>
      <CircleAlert size={16} className="mt-0.5 shrink-0" aria-hidden />
      <p>{children}</p>
    </div>
  );
}
