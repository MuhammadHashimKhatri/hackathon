import AssistantChat from "@/components/ai/AssistantChat";
import PageHeader from "@/components/ui/PageHeader";
import RoleGate from "@/components/shell/RoleGate";

export const metadata = { title: "AI Assistant" };

export default function AssistantPage() {
  return (
    <RoleGate href="/assistant">
      <PageHeader
        title="AI Assistant"
        description="Ask about attendance, leave, payroll and company policy. Answers only use data your role can see."
      />
      <AssistantChat variant="inline" />
    </RoleGate>
  );
}
