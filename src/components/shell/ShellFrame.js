"use client";

import { useCallback, useMemo, useState } from "react";
import Link from "next/link";
import { Menu, Sparkles } from "lucide-react";
import Button from "@/components/ui/Button";
import Drawer from "@/components/ui/Drawer";
import AssistantChat from "@/components/ai/AssistantChat";
import { ShellContext } from "./ShellContext";
import NotificationsBell from "./NotificationsBell";

function Wordmark() {
  return (
    <Link href="/dashboard" className="flex items-center gap-2 text-base font-semibold tracking-tight text-ink">
      <span aria-hidden className="flex size-7 items-center justify-center rounded-md bg-accent text-sm font-bold text-accent-ink">
        H
      </span>
      HCM Lite
    </Link>
  );
}

// nav / userMenu are server-rendered slots (they read the role inside <Suspense>).
export default function ShellFrame({ nav, userMenu, companyName, children }) {
  const [navOpen, setNavOpen] = useState(false);
  const [assistantOpen, setAssistantOpen] = useState(false);

  const closeNav = useCallback(() => setNavOpen(false), []);
  const openAssistant = useCallback(() => setAssistantOpen(true), []);
  const shell = useMemo(() => ({ closeNav, openAssistant }), [closeNav, openAssistant]);

  return (
    <ShellContext.Provider value={shell}>
      <div className="min-h-dvh lg:grid lg:grid-cols-[15.5rem_1fr]">
        <aside className="sticky top-0 hidden h-dvh flex-col border-r border-line bg-surface lg:flex">
          <div className="flex h-14 shrink-0 items-center border-b border-line px-5">
            <Wordmark />
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto">{nav}</div>
        </aside>

        <div className="flex min-w-0 flex-col">
          <header className="sticky top-0 z-30 flex h-14 items-center gap-2 border-b border-line bg-surface/90 px-3 backdrop-blur sm:px-4 lg:px-8">
            <Button
              variant="ghost"
              size="icon"
              icon={Menu}
              aria-label="Open menu"
              onClick={() => setNavOpen(true)}
              className="lg:hidden"
            />
            <p className="min-w-0 flex-1 truncate text-sm font-semibold text-ink">
              {companyName ?? <span className="text-muted">Company not set up</span>}
            </p>
            <Button variant="ghost" size="sm" icon={Sparkles} onClick={openAssistant} aria-label="Open AI assistant">
              <span className="hidden sm:inline">Assistant</span>
            </Button>
            <NotificationsBell />
            {userMenu}
          </header>

          <main className="mx-auto w-full max-w-[75rem] flex-1 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">{children}</main>
        </div>
      </div>

      <Drawer open={navOpen} onClose={closeNav} side="left" title={<Wordmark />}>
        {nav}
      </Drawer>

      <AssistantChat open={assistantOpen} onClose={() => setAssistantOpen(false)} />
    </ShellContext.Provider>
  );
}
