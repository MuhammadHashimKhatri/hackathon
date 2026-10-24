import { LoaderCircle } from "lucide-react";
import { cn } from "@/lib/cn";

export default function Spinner({ size = 16, className, label = "Loading" }) {
  return (
    <LoaderCircle
      size={size}
      className={cn("animate-spin", className)}
      role="status"
      aria-label={label}
    />
  );
}
