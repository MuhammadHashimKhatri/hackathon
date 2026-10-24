"use client";

import { useId } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/cn";
import Button from "./Button";
import useDialogElement from "./useDialogElement";

const sizes = { sm: "max-w-sm", md: "max-w-lg", lg: "max-w-2xl" };

export default function Dialog({ open, onClose, title, description, footer, size = "md", children }) {
  const dialogProps = useDialogElement(open, onClose);
  const titleId = useId();
  const descId = useId();

  return (
    <dialog
      {...dialogProps}
      aria-labelledby={titleId}
      aria-describedby={description ? descId : undefined}
      className={cn(
        "m-auto w-[calc(100%-2rem)] rounded-xl border border-line bg-surface p-0 text-ink shadow-xl",
        "open:animate-[rise-in_160ms_ease-out]",
        sizes[size]
      )}
    >
      {open ? (
        <div className="flex max-h-[85dvh] flex-col">
          <header className="flex items-start justify-between gap-4 px-5 pt-5">
            <div>
              <h2 id={titleId} className="text-base font-semibold">
                {title}
              </h2>
              {description ? (
                <p id={descId} className="mt-1 text-[0.8125rem] text-muted">
                  {description}
                </p>
              ) : null}
            </div>
            <Button variant="ghost" size="icon" icon={X} aria-label="Close" onClick={onClose} />
          </header>
          <div className="overflow-y-auto px-5 py-4">{children}</div>
          {footer ? <footer className="flex flex-wrap justify-end gap-2 border-t border-line px-5 py-3">{footer}</footer> : null}
        </div>
      ) : null}
    </dialog>
  );
}
