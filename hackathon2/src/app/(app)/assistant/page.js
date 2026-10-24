import AIChatPanel from "@/components/ai/AIChatPanel";
import PageHeader from "@/components/ui/PageHeader";

export const metadata = { title: "AI Assistant" };

export default function AssistantPage() {
  return (
    <>
      <PageHeader
        title="AI Assistant"
        description="Ask about attendance, leave, payroll and company policy. Answers only use data your role can see."
      />
      <AIChatPanel variant="inline" />
    </>
  );
}
