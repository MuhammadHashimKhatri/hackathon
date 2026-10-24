import { CalendarDays, Megaphone, ReceiptText } from "lucide-react";
import Card from "@/components/ui/Card";
import PageHeader from "@/components/ui/PageHeader";
import StatCard from "@/components/ui/StatCard";
import AskAssistantButton from "./AskAssistantButton";
import ChartPanel from "./ChartPanel";
import CheckInWidget from "@/components/attendance/CheckInWidget";
import { getPageActor } from "@/server/auth/session";
import { getToday } from "@/server/services/attendance";

// Spec §7 Employee dashboard. Check-in is live (Prompt 6); the rest comes in Prompt 9.
export default async function EmployeeDashboard() {
  const today = await getToday(await getPageActor());
  return (
    <>
      <PageHeader title="Dashboard" description="Your attendance, leave and pay at a glance." />
      <div className="flex flex-col gap-4">
        <Card title="Today" description="Check in when you arrive and check out when you leave.">
          <CheckInWidget today={today} compact />
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
