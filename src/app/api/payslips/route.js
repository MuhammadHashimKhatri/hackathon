import { withApi } from "@/server/http";
import { requireActor } from "@/server/auth/guard";
import { listPayslips } from "@/server/services/payroll";

export const GET = withApi(async () => {
  const actor = await requireActor();
  return Response.json({ payslips: await listPayslips(actor) });
});
