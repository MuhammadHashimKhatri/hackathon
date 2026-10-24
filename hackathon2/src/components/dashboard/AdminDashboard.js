import { Megaphone, ScrollText, Users, Wallet } from "lucide-react";
import PageHeader from "@/components/ui/PageHeader";
import StatCard from "@/components/ui/StatCard";
import ChartPanel from "./ChartPanel";
import DashboardFilters from "./DashboardFilters";
import SummarizeButton from "./SummarizeButton";

// Spec §7 Admin dashboard. Numbers come from the metrics services in Prompt 9.
export default function AdminDashboard() {
  return (
    <>
      <PageHeader title="Dashboard" description="Company-wide headcount, attrition and payroll." actions={<SummarizeButton />} />
      <div className="flex flex-col gap-4">
        <DashboardFilters />
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <StatCard label="Headcount" value={null} />
          <StatCard label="Attrition YTD" value={null} />
          <StatCard label="Payroll cost" value={null} />
          <StatCard label="Average salary" value={null} />
        </div>
        <div className="grid gap-4 lg:grid-cols-2">
          <ChartPanel
            title="Headcount by department"
            icon={Users}
            empty={{ title: "No employees yet", description: "Add departments, then HR can register employees." }}
          />
          <ChartPanel
            title="Payroll cost by department"
            icon={Wallet}
            empty={{ title: "No payroll runs yet", description: "Costs appear after HR runs payroll for a month." }}
          />
          <ChartPanel
            title="Gender and tenure"
            icon={Users}
            empty={{ title: "No employees yet", description: "The split appears once employees are registered." }}
          />
          <ChartPanel
            title="Recent activity"
            icon={ScrollText}
            empty={{ title: "No activity yet", description: "Changes made by Admin and HR are listed here." }}
          />
        </div>
        <ChartPanel
          title="Announcements"
          icon={Megaphone}
          empty={{ title: "No announcements", description: "Posts from Admin and HR show here for everyone." }}
        />
      </div>
    </>
  );
}
