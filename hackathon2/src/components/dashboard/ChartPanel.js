import { ChartColumn } from "lucide-react";
import Card from "@/components/ui/Card";
import EmptyState from "@/components/ui/EmptyState";

// A dashboard section. With no children it shows the given empty state
// (charts arrive with the metrics in Prompt 9).
export default function ChartPanel({ title, description, actions, empty, icon = ChartColumn, className, children }) {
  return (
    <Card title={title} description={description} actions={actions} className={className}>
      {children ?? <EmptyState compact icon={icon} title={empty.title} description={empty.description} />}
    </Card>
  );
}
