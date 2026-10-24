import { cn } from "@/lib/cn";

export default function Card({ title, description, actions, padding = true, className, children }) {
  const hasHeader = title || description || actions;
  return (
    <section className={cn("rounded-xl border border-line bg-surface", className)}>
      {hasHeader ? (
        <header className="flex flex-wrap items-start justify-between gap-3 px-4 pt-4 sm:px-5">
          <div className="min-w-0">
            {title ? <h2 className="text-base font-semibold text-ink">{title}</h2> : null}
            {description ? <p className="mt-0.5 text-[0.8125rem] text-muted">{description}</p> : null}
          </div>
          {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
        </header>
      ) : null}
      <div className={cn(padding && "p-4 sm:p-5", hasHeader && padding && "pt-3 sm:pt-3")}>{children}</div>
    </section>
  );
}
