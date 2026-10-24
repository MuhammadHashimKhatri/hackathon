"use client";

import { useState } from "react";
import { postJson } from "@/lib/api";
import AIChatPanel from "./AIChatPanel";

const SUGGESTIONS = [
  "How many sick leaves do I have left this year?",
  "What is this month's attendance rate?",
  "Who came late most often this month?",
  "Who is on leave next week?",
];

let nextId = 0;
const message = (role, content) => ({ id: `m${++nextId}`, role, content });

// AIChatPanel wired to POST /api/ai/chat. The conversation lives in memory only.
export default function AssistantChat(props) {
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(false);

  async function onSend(text) {
    const history = [...messages, message("user", text)];
    setMessages(history);
    setLoading(true);
    const result = await postJson("/api/ai/chat", { messages: history.map(({ role, content }) => ({ role, content })) });
    setLoading(false);
    const reply = result.ok
      ? result.data.reply
      : result.status === 429
        ? result.error?.message
        : result.error?.message ?? "The assistant couldn't answer right now. Please try again.";
    setMessages((m) => [...m, message("assistant", reply)]);
  }

  return <AIChatPanel {...props} messages={messages} onSend={onSend} loading={loading} suggestions={SUGGESTIONS} />;
}
