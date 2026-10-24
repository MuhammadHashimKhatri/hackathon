import Link from "next/link";
import { cn } from "@/lib/cn";
import Spinner from "./Spinner";

const variants = {
  primary: "bg-accent text-accent-ink hover:opacity-90",
  secondary: "border border-line bg-surface text-ink hover:bg-surface-2",
  ghost: "text-ink hover:bg-surface-2",
  danger: "bg-danger text-surface hover:opacity-90",
  "danger-ghost": "text-danger hover:bg-danger-soft",
};

const sizes = {
  sm: "h-8 gap-1.5 px-3 text-[0.8125rem]",
  md: "h-10 gap-2 px-4 text-sm",
  icon: "size-9 justify-center",
};

export function buttonClass({ variant = "secondary", size = "md", className } = {}) {
  return cn(
    "inline-flex shrink-0 items-center justify-center rounded-lg font-medium whitespace-nowrap transition-colors",
    "disabled:cursor-not-allowed disabled:opacity-50 aria-disabled:pointer-events-none aria-disabled:opacity-50",
    variants[variant],
    sizes[size],
    className
  );
}

export default function Button({
  variant = "secondary",
  size = "md",
  loading = false,
  icon: Icon,
  type = "button",
  disabled,
  className,
  children,
  ...rest
}) {
  return (
    <button
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={buttonClass({ variant, size, className })}
      {...rest}
    >
      {loading ? <Spinner size={16} /> : Icon ? <Icon size={16} aria-hidden /> : null}
      {children}
    </button>
  );
}

export function ButtonLink({ href, variant = "secondary", size = "md", icon: Icon, className, children, ...rest }) {
  return (
    <Link href={href} className={buttonClass({ variant, size, className })} {...rest}>
      {Icon ? <Icon size={16} aria-hidden /> : null}
      {children}
    </Link>
  );
}
