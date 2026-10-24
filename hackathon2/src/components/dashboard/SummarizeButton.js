"use client";

import { useState, useTransition } from "react";
import { useSearchParams } from "next/navigation";
import { Sparkles } from "lucide-react";
import { postJson } from "@/lib/api";
import AIBadge from "@/components/ui/AIBadge";
import Button from "@/components/ui/Button";
import Dialog from "@/components/ui/Dialog";
import FormAlert from "@/components/ui/FormAlert";

// Sends the current filters; the server recomputes the KPI JSON and the AI
// writes 3–5 bullets from those numbers only (Spec §8). Render inside Suspense.
export default function SummarizeButton() {
  const searchParams = useSearchParams();
  const [open, setOpen] = useState(false);
  const [result, setResult] = useState(null);
  const [pending, startTransition] = useTransition();

  function run() {
    setOpen(true);
    setResult(null);
    startTransition(async () => {
      const body = Object.fromEntries(["from", "to", "dept"].map((k) => [k, searchParams.get(k) || undefined]));
      const res = await postJson("/api/ai/summary", body);
      setResult(res.ok ? res.data : { error: res.error?.message ?? "The summary isn't available right now." });
    });
  }

  return (
    <>
      <Button icon={Sparkles} onClick={run} loading={pending}>
        Summarize
      </Button>
      <Dialog open={open} onClose={() => setOpen(false)} title="Dashboard summary" description="Based only on the numbers shown for the current filters.">
        {pending || !result ? (
          <p className="text-sm text-muted">Reading the numbers…</p>
        ) : result.error || result.fallback ? (
          <FormAlert>{result.error ?? result.message}</FormAlert>
        ) : (
          <div className="flex flex-col gap-3">
            <ul className="flex list-disc flex-col gap-1.5 pl-5 text-sm">
              {result.bullets.map((b, i) => (
                <li key={i}>{b}</li>
              ))}
            </ul>
            <AIBadge />
          </div>
        )}
      </Dialog>
    </>
  );
}
