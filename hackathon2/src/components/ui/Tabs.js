"use client";

import { useId, useRef, useState } from "react";
import { cn } from "@/lib/cn";

// tabs: [{ id, label }]; children: (activeId) => ReactNode
// Controlled with value/onChange, or uncontrolled with defaultValue.
export default function Tabs({ tabs, value, onChange, defaultValue, className, children }) {
  const [internal, setInternal] = useState(defaultValue ?? tabs[0]?.id);
  const active = value ?? internal;
  const baseId = useId();
  const listRef = useRef(null);

  function select(id) {
    if (value === undefined) setInternal(id);
    onChange?.(id);
  }

  function onKeyDown(e) {
    const index = tabs.findIndex((t) => t.id === active);
    let next = null;
    if (e.key === "ArrowRight") next = (index + 1) % tabs.length;
    if (e.key === "ArrowLeft") next = (index - 1 + tabs.length) % tabs.length;
    if (e.key === "Home") next = 0;
    if (e.key === "End") next = tabs.length - 1;
    if (next === null) return;
    e.preventDefault();
    select(tabs[next].id);
    listRef.current?.querySelectorAll('[role="tab"]')[next]?.focus();
  }

  return (
    <div className={className}>
      <div
        ref={listRef}
        role="tablist"
        onKeyDown={onKeyDown}
        className="flex gap-1 overflow-x-auto border-b border-line"
      >
        {tabs.map((t) => {
          const selected = t.id === active;
          return (
            <button
              key={t.id}
              type="button"
              role="tab"
              id={`${baseId}-tab-${t.id}`}
              aria-selected={selected}
              aria-controls={`${baseId}-panel`}
              tabIndex={selected ? 0 : -1}
              onClick={() => select(t.id)}
              className={cn(
                "-mb-px border-b-2 px-3 py-2 text-sm font-medium whitespace-nowrap transition-colors",
                selected ? "border-accent text-ink" : "border-transparent text-muted hover:text-ink"
              )}
            >
              {t.label}
            </button>
          );
        })}
      </div>
      <div role="tabpanel" id={`${baseId}-panel`} aria-labelledby={`${baseId}-tab-${active}`} className="pt-4">
        {children?.(active)}
      </div>
    </div>
  );
}
