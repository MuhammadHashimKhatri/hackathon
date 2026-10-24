import { CalendarDays, MapPin, Megaphone, ReceiptText } from "lucide-react";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import EmptyState from "@/components/ui/EmptyState";
import PageHeader from "@/components/ui/PageHeader";
import StatCard from "@/components/ui/StatCard";
import AskAssistantButton from "./AskAssistantButton";
import ChartPanel from "./ChartPanel";

// Spec §7 Employee dashboard. Check-in is wired in Prompt 6, the rest in Prompt 9.
export default function EmployeeDashboard() {
  return (
    <>
      <PageHeader title="Dashboard" description="Your attendance, leave and pay at a glance." />
      <div className="flex flex-col gap-4">
        <Card title="Today" description="Check in when you arrive and check out when you leave.">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <EmptyState
              compact
              icon={MapPin}
              title="No employee record linked"
              description="Ask HR to register you as an employee to start checking in."
              className="items-start py-0 text-left sm:flex-row sm:items-center"
            />
            <Button variant="primary" icon={MapPin} disabled className="w-full sm:w-auto">
              Check in
            </Button>
          </div>
        </Card>
        <div className="grid grid-cols-2 gap-3">
          <StatCard label="Hours this week" value={null} hint="Target 40 h" />
          <StatCard label="Late this month" value={null} />
        </div>
        <div className="grid gap-4 lg:grid-cols-2">
          <ChartPanel
            title="Leave balances"
            icon={CalendarDays}
            empty={{ title: "No leave types yet", description: "Balances appear once Admin sets up leave types." }}
          />
          <ChartPanel
            title="Last payslip"
            icon={ReceiptText}
            empty={{ title: "No payslips yet", description: "Your payslip appears after payroll for a month is finalized." }}
          />
          <ChartPanel
            title="Announcements"
            icon={Megaphone}
            empty={{ title: "No announcements", description: "Company news from Admin and HR shows up here." }}
          />
          <Card title="Assistant" description="Ask about your leave balance, attendance or policies.">
            <AskAssistantButton />
          </Card>
        </div>
      </div>
    </>
  );
}
