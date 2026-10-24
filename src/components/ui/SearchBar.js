"use client";

import { useEffect, useRef, useState } from "react";
import { Search } from "lucide-react";
import { cn } from "@/lib/cn";
import { controlClass } from "./Field";
import useUrlParams from "./useUrlParams";

// Debounced ?q= search. Render inside <Suspense> (uses useSearchParams).
export default function SearchBar({ placeholder = "Search", param = "q", debounceMs = 300, label = "Search", className }) {
  const { searchParams, setParams } = useUrlParams();
  const [value, setValue] = useState(() => searchParams.get(param) ?? "");
  const timer = useRef(null);

  useEffect(() => () => clearTimeout(timer.current), []);

  function onChange(e) {
    const next = e.target.value;
    setValue(next);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setParams({ [param]: next.trim() }), debounceMs);
  }

  return (
    <div role="search" className={cn("relative w-full sm:max-w-xs", className)}>
      <Search size={16} aria-hidden className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-muted" />
      <input
        type="search"
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        aria-label={label}
        className={cn(controlClass, "h-10 pl-9")}
      />
    </div>
  );
}
