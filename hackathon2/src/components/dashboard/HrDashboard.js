import { CalendarCheck, Clock, Megaphone, TrendingUp, Users } from "lucide-react";
import PageHeader from "@/components/ui/PageHeader";
import StatCard from "@/components/ui/StatCard";
import ChartPanel from "./ChartPanel";
import DashboardFilters from "./DashboardFilters";
import SummarizeButton from "./SummarizeButton";

// Spec §7 HR dashboard. Numbers come from the metrics services in Prompt 9.
export default function HrDashboard() {
  return (
    <>
      <PageHeader title="Dashboard" description="Today's attendance, leave and approvals." actions={<SummarizeButton />} />
      <div className="flex flex-col gap-4">
        <DashboardFilters />
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
          <StatCard label="Headcount" value={null} />
          <StatCard label="Present today" value={null} />
          <StatCard label="On leave today" value={null} />
          <StatCard label="Late today" value={null} />
          <StatCard label="Pending approvals" value={null} className="col-span-2 md:col-span-1" />
        </div>
        <ChartPanel
          title="Attendance trend"
          icon={TrendingUp}
          empty={{ title: "No attendance yet", description: "The trend starts with the first check-in." }}
        />
        <div className="grid gap-4 lg:grid-cols-2">
          <ChartPanel
            title="Absenteeism by department"
            icon={Users}
            empty={{ title: "No attendance yet", description: "Absences are counted per department on working days." }}
          />
          <ChartPanel
            title="Leave by type"
            icon={CalendarCheck}
            empty={{ title: "No leave taken yet", description: "Approved leave is grouped by leave type here." }}
          />
          <ChartPanel
            title="Top 5 late-comers"
            icon={Clock}
            empty={{ title: "No late check-ins", description: "Employees who check in after the grace period appear here." }}
          />
          <ChartPanel
            title="Announcements"
            icon={Megaphone}
            empty={{ title: "No announcements", description: "Posts from Admin and HR show here for everyone." }}
          />
        </div>
      </div>
    </>
  );
}
