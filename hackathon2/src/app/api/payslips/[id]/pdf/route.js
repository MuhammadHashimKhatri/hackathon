import { withApi } from "@/server/http";
import { requireActor } from "@/server/auth/guard";
import { getPayslip } from "@/server/services/payroll";
import { loadSettings } from "@/server/services/settings";
import { renderPayslipPdf } from "@/server/pdf/Payslip";

export const GET = withApi(async (_request, { params }) => {
  const actor = await requireActor();
  const { id } = await params;
  const [payslip, settings] = await Promise.all([getPayslip(actor, id), loadSettings()]);
  const pdf = await renderPayslipPdf(settings.company_name, payslip);
  return new Response(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="payslip-${payslip.employeeCode}-${payslip.month.slice(0, 7)}.pdf"`,
      "Cache-Control": "private, no-store",
    },
  });
});
