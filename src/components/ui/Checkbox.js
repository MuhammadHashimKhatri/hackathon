import { cn } from "@/lib/cn";
import { fieldIds } from "./Field";

export default function Checkbox({ label, name, id, description, error, className, ...rest }) {
  const { controlId, hintId, errorId } = fieldIds(name, id);
  return (
    <div className={cn("flex flex-col gap-1", className)}>
      <div className="flex items-start gap-2.5">
        <input
          id={controlId}
          name={name}
          type="checkbox"
          aria-invalid={error ? true : undefined}
          aria-describedby={[description && hintId, error && errorId].filter(Boolean).join(" ") || undefined}
          className="mt-0.5 size-4 shrink-0 rounded border-line accent-accent"
          {...rest}
        />
        <div className="flex flex-col">
          <label htmlFor={controlId} className="text-sm font-medium text-ink">
            {label}
          </label>
          {description ? (
            <p id={hintId} className="text-[0.8125rem] text-muted">
              {description}
            </p>
          ) : null}
        </div>
      </div>
      {error ? (
        <p id={errorId} className="pl-6.5 text-[0.8125rem] text-danger">
          {error}
        </p>
      ) : null}
    </div>
  );
}
