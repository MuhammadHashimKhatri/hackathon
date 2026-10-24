"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { buttonClass } from "./Button";

// Reads/writes ?page=N. Render inside <Suspense> (uses useSearchParams).
export default function Pagination({ page = 1, pageSize = 20, total = 0, param = "page" }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  if (total <= pageSize) return null;

  const hrefFor = (p) => {
    const params = new URLSearchParams(searchParams);
    if (p <= 1) params.delete(param);
    else params.set(param, String(p));
    const qs = params.toString();
    return qs ? `${pathname}?${qs}` : pathname;
  };

  const from = (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);
  const prevDisabled = page <= 1;
  const nextDisabled = page >= pageCount;

  return (
    <nav aria-label="Pagination" className="flex items-center justify-between gap-3 pt-4">
      <p className="figure text-[0.8125rem] text-muted">
        {from}–{to} of {total}
      </p>
      <div className="flex gap-2">
        <Link
          href={hrefFor(page - 1)}
          aria-disabled={prevDisabled || undefined}
          tabIndex={prevDisabled ? -1 : undefined}
          className={buttonClass({ size: "sm" })}
        >
          <ChevronLeft size={16} aria-hidden /> Previous
        </Link>
        <Link
          href={hrefFor(page + 1)}
          aria-disabled={nextDisabled || undefined}
          tabIndex={nextDisabled ? -1 : undefined}
          className={buttonClass({ size: "sm" })}
        >
          Next <ChevronRight size={16} aria-hidden />
        </Link>
      </div>
    </nav>
  );
}
