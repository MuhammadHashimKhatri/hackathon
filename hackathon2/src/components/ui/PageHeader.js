import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/cn";

export default function PageHeader({ title, description, actions, breadcrumbs, className }) {
  return (
    <header className={cn("mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between", className)}>
      <div className="min-w-0">
        {breadcrumbs?.length ? (
          <nav aria-label="Breadcrumb" className="mb-1.5">
            <ol className="flex flex-wrap items-center gap-1 text-[0.8125rem] text-muted">
              {breadcrumbs.map((b, i) => (
                <li key={b.href ?? b.label} className="flex items-center gap-1">
                  {i > 0 ? <ChevronRight size={14} aria-hidden /> : null}
                  {b.href ? (
                    <Link href={b.href} className="hover:text-ink">
                      {b.label}
                    </Link>
                  ) : (
                    <span>{b.label}</span>
                  )}
                </li>
              ))}
            </ol>
          </nav>
        ) : null}
        <h1 className="text-2xl font-semibold tracking-tight text-ink">{title}</h1>
        {description ? <p className="mt-1 max-w-prose text-sm text-muted">{description}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </header>
  );
}
