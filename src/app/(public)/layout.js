import ThemeToggle from "@/components/shell/ThemeToggle";

export default function PublicLayout({ children }) {
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="flex h-14 items-center justify-between px-4 sm:px-6">
        <span className="flex items-center gap-2 text-base font-semibold tracking-tight text-ink">
          <span aria-hidden className="flex size-7 items-center justify-center rounded-md bg-accent text-sm font-bold text-accent-ink">
            H
          </span>
          HCM Lite
        </span>
        <ThemeToggle />
      </header>
      <main className="flex flex-1 items-start justify-center px-4 pt-8 pb-16 sm:items-center sm:pt-0">
        <div className="w-full max-w-sm">{children}</div>
      </main>
    </div>
  );
}
