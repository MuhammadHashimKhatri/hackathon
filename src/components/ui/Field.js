import { cn } from "@/lib/cn";

export const controlClass = cn(
  "w-full rounded-lg border border-line bg-surface px-3 text-sm text-ink placeholder:text-muted",
  "focus-visible:border-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/25",
  "disabled:cursor-not-allowed disabled:bg-surface-2 disabled:text-muted",
  "aria-invalid:border-danger aria-invalid:focus-visible:ring-danger/25"
);

export function fieldIds(name, id) {
  const controlId = id ?? `field-${name}`;
  return { controlId, hintId: `${controlId}-hint`, errorId: `${controlId}-error` };
}

export function describedBy({ hint, error }, { hintId, errorId }) {
  return [hint && hintId, error && errorId].filter(Boolean).join(" ") || undefined;
}

export default function Field({ label, htmlFor, required, hint, error, hintId, errorId, className, children }) {
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      {label ? (
        <label htmlFor={htmlFor} className="text-sm font-medium text-ink">
          {label}
          {required ? <span className="text-danger"> *</span> : null}
        </label>
      ) : null}
      {children}
      {hint && !error ? (
        <p id={hintId} className="text-[0.8125rem] text-muted">
          {hint}
        </p>
      ) : null}
      {error ? (
        <p id={errorId} className="text-[0.8125rem] text-danger">
          {error}
        </p>
      ) : null}
    </div>
  );
}
