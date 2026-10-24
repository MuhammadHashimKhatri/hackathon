"use client";

import { useEffect } from "react";
import ErrorState from "@/components/ui/ErrorState";

export default function PublicError({ error, retry }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="rounded-xl border border-line bg-surface">
      <ErrorState onRetry={() => retry()} />
    </div>
  );
}
