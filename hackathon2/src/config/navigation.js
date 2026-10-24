import {
  Banknote,
  Building2,
  CalendarCheck,
  CalendarDays,
  CalendarRange,
  ClipboardCheck,
  Clock,
  FileSpreadsheet,
  LayoutDashboard,
  MapPin,
  Megaphone,
  Network,
  ReceiptText,
  ScrollText,
  Sparkles,
  UserCog,
  UserRound,
  Users,
  Wallet,
} from "lucide-react";

export const ROLES = ["admin", "hr", "employee"];

export const ROLE_LABELS = { admin: "Admin", hr: "HR", employee: "Employee" };

// The only source of sidebar/drawer menus (Spec §4, Prompt 1).
export const NAV = {
  admin: [
    { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
    { label: "Company Settings", href: "/settings/company", icon: Building2 },
    { label: "Departments & Designations", href: "/settings/organization", icon: Network },
    { label: "Leave Types & Holidays", href: "/settings/leave", icon: CalendarRange },
    { label: "Users", href: "/users", icon: UserCog },
    { label: "Employees", href: "/employees", icon: Users },
    { label: "Attendance", href: "/attendance", icon: Clock },
    { label: "Leave", href: "/leave", icon: CalendarCheck },
    { label: "Payroll", href: "/payroll", icon: Wallet },
    { label: "Payslips", href: "/payslips", icon: ReceiptText },
    { label: "Announcements", href: "/announcements", icon: Megaphone },
    { label: "Audit Log", href: "/audit", icon: ScrollText },
    { label: "AI Assistant", href: "/assistant", icon: Sparkles },
  ],
  hr: [
    { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
    { label: "Employees", href: "/employees", icon: Users },
    { label: "Import/Export", href: "/employees/import", icon: FileSpreadsheet },
    { label: "Attendance Board", href: "/attendance", icon: Clock },
    { label: "Corrections", href: "/attendance/corrections", icon: ClipboardCheck },
    { label: "Leave Approvals", href: "/leave", icon: CalendarCheck },
    { label: "My Leave", href: "/leave/me", icon: CalendarDays },
    { label: "Salary Structures", href: "/salary", icon: Banknote },
    { label: "Payroll", href: "/payroll", icon: Wallet },
    { label: "Payslips", href: "/payslips", icon: ReceiptText },
    { label: "Announcements", href: "/announcements", icon: Megaphone },
    { label: "AI Assistant", href: "/assistant", icon: Sparkles },
  ],
  employee: [
    { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
    { label: "Check-in", href: "/check-in", icon: MapPin },
    { label: "My Attendance", href: "/attendance/me", icon: Clock },
    { label: "My Leave", href: "/leave/me", icon: CalendarDays },
    { label: "My Payslips", href: "/payslips", icon: ReceiptText },
    { label: "My Profile", href: "/profile", icon: UserRound },
    { label: "Announcements", href: "/announcements", icon: Megaphone },
    { label: "AI Assistant", href: "/assistant", icon: Sparkles },
  ],
};

// Longest matching href wins, so /attendance/corrections doesn't also light up /attendance.
export function activeHref(items, pathname) {
  let best = null;
  for (const { href } of items) {
    if (pathname === href || pathname.startsWith(`${href}/`)) {
      if (!best || href.length > best.length) best = href;
    }
  }
  return best;
}
