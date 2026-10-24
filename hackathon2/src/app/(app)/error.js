"use client";

import { useEffect } from "react";
import Card from "@/components/ui/Card";
import ErrorState from "@/components/ui/ErrorState";

export default function AppError({ error, retry }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <Card>
      <ErrorState onRetry={() => retry()} />
    </Card>
  );
}
