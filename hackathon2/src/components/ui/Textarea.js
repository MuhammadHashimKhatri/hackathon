import { cn } from "@/lib/cn";
import Field, { controlClass, describedBy, fieldIds } from "./Field";

export default function Textarea({ label, name, id, rows = 3, hint, error, required, className, ...rest }) {
  const ids = fieldIds(name, id);
  return (
    <Field label={label} htmlFor={ids.controlId} required={required} hint={hint} error={error} {...ids} className={className}>
      <textarea
        id={ids.controlId}
        name={name}
        rows={rows}
        required={required}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy({ hint, error }, ids)}
        className={cn(controlClass, "py-2")}
        {...rest}
      />
    </Field>
  );
}
