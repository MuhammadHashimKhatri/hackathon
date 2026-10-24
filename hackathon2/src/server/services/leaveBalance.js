import "server-only";
import { getDb } from "@/server/db";

// Leave balances for one employee and year (Spec §6 Leave). No role check:
// callers (Employee 360 now, the leave service in Prompt 7) check scope first.
//   balance   = quota − approved days
//   available = quota − approved − pending      (null quota = unlimited)
export async function getLeaveBalances(employeeId, year) {
  const db = getDb();
  const [types, requests] = await Promise.all([
    db.from("leave_types").select("id, code, name, yearly_quota, is_paid").order("name"),
    // Requests never span two years (DB constraint), so the start date picks the year.
    db
      .from("leave_requests")
      .select("leave_type_id, days, status")
      .eq("employee_id", employeeId)
      .in("status", ["pending", "approved"])
      .gte("start_date", `${year}-01-01`)
      .lte("start_date", `${year}-12-31`),
  ]);
  if (types.error) throw types.error;
  if (requests.error) throw requests.error;

  return types.data.map((t) => {
    const mine = requests.data.filter((r) => r.leave_type_id === t.id);
    const sum = (status) => mine.filter((r) => r.status === status).reduce((n, r) => n + Number(r.days), 0);
    const approved = sum("approved");
    const pending = sum("pending");
    const quota = t.yearly_quota;
    return {
      leaveTypeId: t.id,
      code: t.code,
      name: t.name,
      isPaid: t.is_paid,
      quota,
      approved,
      pending,
      balance: quota === null ? null : quota - approved,
      available: quota === null ? null : quota - approved - pending,
    };
  });
}
