"use client";

import { Sparkles } from "lucide-react";
import Button from "@/components/ui/Button";
import { useShell } from "@/components/shell/ShellContext";

export default function AskAssistantButton() {
  const { openAssistant } = useShell();
  return (
    <Button variant="primary" icon={Sparkles} onClick={openAssistant}>
      Ask my assistant
    </Button>
  );
}
