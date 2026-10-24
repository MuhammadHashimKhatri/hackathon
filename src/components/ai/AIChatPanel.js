"use client";

import { useEffect, useRef, useState } from "react";
import { Send, Sparkles } from "lucide-react";
import { cn } from "@/lib/cn";
import AIBadge from "@/components/ui/AIBadge";
import Button from "@/components/ui/Button";
import Drawer from "@/components/ui/Drawer";
import EmptyState from "@/components/ui/EmptyState";
import { controlClass } from "@/components/ui/Field";

function LoadingDots() {
  return (
    <div role="status" aria-label="Assistant is thinking" className="flex gap-1 px-1 py-2">
      {[0, 160, 320].map((delay) => (
        <span
          key={delay}
          className="size-2 rounded-full bg-muted"
          style={{ animation: `dot-pulse 1.2s ${delay}ms infinite ease-in-out` }}
        />
      ))}
    </div>
  );
}

function Message({ message }) {
  const fromUser = message.role === "user";
  return (
    <li className={cn("flex flex-col gap-1.5", fromUser ? "items-end" : "items-start")}>
      <div
        className={cn(
          "max-w-[85%] rounded-2xl px-3.5 py-2 text-sm whitespace-pre-wrap",
          fromUser ? "rounded-br-sm bg-accent text-accent-ink" : "rounded-bl-sm bg-surface-2 text-ink"
        )}
      >
        {message.content}
      </div>
      {fromUser ? null : <AIBadge />}
    </li>
  );
}

// messages: [{ id, role: "user" | "assistant", content }]
// onSend(text) is wired in Prompt 10; without it the input is disabled.
function ChatBody({ messages = [], onSend, loading = false, suggestions = [] }) {
  const [draft, setDraft] = useState("");
  const listEnd = useRef(null);
  const connected = typeof onSend === "function";

  useEffect(() => {
    listEnd.current?.scrollIntoView({ block: "end" });
  }, [messages.length, loading]);

  function submit(text) {
    const value = text.trim();
    if (!value || !connected || loading) return;
    onSend(value);
    setDraft("");
  }

  function onKeyDown(e) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      submit(draft);
    }
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
        {messages.length === 0 && !loading ? (
          connected ? (
            <EmptyState
              icon={Sparkles}
              title="Ask about your company data"
              description="Answers use the same numbers as your dashboards and only the data your role can see."
              action={
                suggestions.length ? (
                  <div className="flex flex-wrap justify-center gap-2">
                    {suggestions.map((s) => (
                      <button
                        key={s}
                        type="button"
                        onClick={() => submit(s)}
                        className="rounded-full border border-line px-3 py-1 text-[0.8125rem] hover:bg-surface-2"
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                ) : null
              }
            />
          ) : (
            <EmptyState
              icon={Sparkles}
              title="The assistant isn't connected yet"
              description="Once the AI service is set up, you can ask about attendance, leave and payroll here."
            />
          )
        ) : (
          <ul className="flex flex-col gap-4" aria-live="polite">
            {messages.map((m) => (
              <Message key={m.id} message={m} />
            ))}
            {loading ? (
              <li>
                <LoadingDots />
              </li>
            ) : null}
          </ul>
        )}
        <div ref={listEnd} />
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          submit(draft);
        }}
        className="flex items-end gap-2 border-t border-line p-3"
      >
        <label htmlFor="ai-chat-input" className="sr-only">
          Message the assistant
        </label>
        <textarea
          id="ai-chat-input"
          rows={1}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={onKeyDown}
          disabled={!connected}
          placeholder={connected ? "Ask a question" : "Assistant not connected"}
          className={cn(controlClass, "field-sizing-content max-h-32 min-h-10 resize-none py-2")}
        />
        <Button
          type="submit"
          variant="primary"
          size="icon"
          icon={Send}
          aria-label="Send"
          disabled={!connected || !draft.trim()}
          loading={loading}
        />
      </form>
    </div>
  );
}

export default function AIChatPanel({ variant = "sheet", open, onClose, title = "AI Assistant", ...chat }) {
  if (variant === "inline") {
    return (
      <section aria-label={title} className="flex h-[min(36rem,70dvh)] flex-col rounded-xl border border-line bg-surface">
        <ChatBody {...chat} />
      </section>
    );
  }

  return (
    <Drawer open={open} onClose={onClose} side="right" title={title} width="w-[min(26rem,100vw)]">
      <ChatBody {...chat} />
    </Drawer>
  );
}
