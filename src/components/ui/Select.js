import { cn } from "@/lib/cn";
import Field, { controlClass, describedBy, fieldIds } from "./Field";

export default function Select({ label, name, id, options = [], placeholder, hint, error, required, className, ...rest }) {
  const ids = fieldIds(name, id);
  return (
    <Field label={label} htmlFor={ids.controlId} required={required} hint={hint} error={error} {...ids} className={className}>
      <select
        id={ids.controlId}
        name={name}
        required={required}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy({ hint, error }, ids)}
        className={cn(controlClass, "h-10 pr-8")}
        {...rest}
      >
        {placeholder !== undefined ? <option value="">{placeholder}</option> : null}
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </Field>
  );
}
