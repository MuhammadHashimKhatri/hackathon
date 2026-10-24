import { Sparkles } from "lucide-react";
import Button from "@/components/ui/Button";

// Wired to POST /api/ai/summary in Prompt 10.
export default function SummarizeButton() {
  return (
    <Button icon={Sparkles} disabled title="Available once the AI service is connected">
      Summarize
    </Button>
  );
}
