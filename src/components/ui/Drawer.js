"use client";

import { useId } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/cn";
import Button from "./Button";
import useDialogElement from "./useDialogElement";

// Full-height side sheet built on <dialog>. Children stay mounted so
// navigation links inside keep their state between openings.
export default function Drawer({ open, onClose, side = "left", title, width = "w-[min(20rem,85vw)]", children }) {
  const dialogProps = useDialogElement(open, onClose);
  const titleId = useId();

  return (
    <dialog
      {...dialogProps}
      aria-labelledby={titleId}
      className={cn(
        "fixed inset-y-0 m-0 h-dvh max-h-none border-line bg-surface p-0 text-ink shadow-xl",
        width,
        side === "left"
          ? "right-auto left-0 border-r open:animate-[slide-in-left_200ms_ease-out]"
          : "right-0 left-auto border-l open:animate-[slide-in-right_200ms_ease-out]"
      )}
    >
      <div className="flex h-full flex-col">
        <header className="flex h-14 shrink-0 items-center justify-between gap-2 border-b border-line px-4">
          <h2 id={titleId} className="text-base font-semibold">
            {title}
          </h2>
          <Button variant="ghost" size="icon" icon={X} aria-label="Close" onClick={onClose} />
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto">{children}</div>
      </div>
    </dialog>
  );
}
