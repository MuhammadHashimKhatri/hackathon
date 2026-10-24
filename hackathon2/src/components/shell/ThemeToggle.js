"use client";

import { useSyncExternalStore } from "react";
import { Monitor, Moon, Sun } from "lucide-react";
import { cn } from "@/lib/cn";

const OPTIONS = [
  { value: "system", label: "System", icon: Monitor },
  { value: "light", label: "Light", icon: Sun },
  { value: "dark", label: "Dark", icon: Moon },
];

const listeners = new Set();

function readTheme() {
  try {
    const t = localStorage.getItem("theme");
    return t === "light" || t === "dark" ? t : "system";
  } catch {
    return "system";
  }
}

function subscribe(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function applyTheme(theme) {
  try {
    if (theme === "system") localStorage.removeItem("theme");
    else localStorage.setItem("theme", theme);
  } catch {}
  if (theme === "system") document.documentElement.removeAttribute("data-theme");
  else document.documentElement.setAttribute("data-theme", theme);
  listeners.forEach((l) => l());
}

export default function ThemeToggle({ className }) {
  const theme = useSyncExternalStore(subscribe, readTheme, () => "system");

  return (
    <div role="radiogroup" aria-label="Theme" className={cn("inline-flex rounded-lg border border-line bg-surface p-0.5", className)}>
      {OPTIONS.map(({ value, label, icon: Icon }) => (
        <button
          key={value}
          type="button"
          role="radio"
          aria-checked={theme === value}
          aria-label={label}
          title={label}
          onClick={() => applyTheme(value)}
          className={cn(
            "flex size-8 items-center justify-center rounded-md transition-colors",
            theme === value ? "bg-surface-2 text-ink" : "text-muted hover:text-ink"
          )}
        >
          <Icon size={16} aria-hidden />
        </button>
      ))}
    </div>
  );
}
