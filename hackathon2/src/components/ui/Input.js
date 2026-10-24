import { cn } from "@/lib/cn";
import Field, { controlClass, describedBy, fieldIds } from "./Field";

export default function Input({ label, name, id, type = "text", hint, error, required, className, ...rest }) {
  const ids = fieldIds(name, id);
  return (
    <Field label={label} htmlFor={ids.controlId} required={required} hint={hint} error={error} {...ids} className={className}>
      <input
        id={ids.controlId}
        name={name}
        type={type}
        required={required}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy({ hint, error }, ids)}
        className={cn(controlClass, "h-10")}
        {...rest}
      />
    </Field>
  );
}
