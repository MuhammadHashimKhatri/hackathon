import { cn } from "@/lib/cn";
import EmptyState from "./EmptyState";
import Skeleton from "./Skeleton";

const alignClass = { left: "text-left", right: "text-right", center: "text-center" };

function cell(column, row) {
  return column.render ? column.render(row) : row[column.key];
}

// columns: [{ key, header, align, render(row), mobileLabel, hideOnMobile }]
// Desktop (md+) is a real <table>; below md each row becomes a card.
export default function Table({ columns, rows = [], rowKey = "id", empty, loading = false, caption, className }) {
  const keyOf = (row) => (typeof rowKey === "function" ? rowKey(row) : row[rowKey]);

  if (loading) {
    return (
      <div className={cn("flex flex-col gap-2", className)} aria-busy>
        {Array.from({ length: 4 }, (_, i) => (
          <Skeleton key={i} className="h-11 w-full" />
        ))}
      </div>
    );
  }

  if (rows.length === 0) {
    return empty ?? <EmptyState title="Nothing to show yet" compact />;
  }

  const mobileColumns = columns.filter((c) => !c.hideOnMobile);
  const [primary, ...secondary] = mobileColumns;

  return (
    <div className={className}>
      <div className="hidden overflow-x-auto md:block">
        <table className="w-full border-collapse text-sm">
          {caption ? <caption className="sr-only">{caption}</caption> : null}
          <thead>
            <tr className="border-b border-line">
              {columns.map((c) => (
                <th
                  key={c.key}
                  scope="col"
                  className={cn("px-3 py-2.5 text-[0.8125rem] font-medium text-muted", alignClass[c.align ?? "left"])}
                >
                  {c.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={keyOf(row)} className="border-b border-line last:border-b-0 hover:bg-surface-2/60">
                {columns.map((c) => (
                  <td key={c.key} className={cn("px-3 py-3 text-ink", alignClass[c.align ?? "left"], c.align === "right" && "figure")}>
                    {cell(c, row)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <ul className="flex flex-col gap-2 md:hidden" aria-label={caption}>
        {rows.map((row) => (
          <li key={keyOf(row)} className="rounded-lg border border-line bg-surface p-3">
            {primary ? <div className="mb-2 font-medium text-ink">{cell(primary, row)}</div> : null}
            <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-[0.8125rem]">
              {secondary.map((c) => (
                <div key={c.key} className="contents">
                  <dt className="text-muted">{c.mobileLabel ?? c.header}</dt>
                  <dd className={cn("text-right text-ink", c.align === "right" && "figure")}>{cell(c, row)}</dd>
                </div>
              ))}
            </dl>
          </li>
        ))}
      </ul>
    </div>
  );
}
