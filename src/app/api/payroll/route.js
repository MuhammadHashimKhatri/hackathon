import { parse, readJson, withApi } from "@/server/http";
import { requireActor } from "@/server/auth/guard";
import { generateDraft, getRunForMonth, listRuns } from "@/server/services/payroll";
import { payrollGenerateSchema, payrollQuery } from "@/lib/validation/payroll";

// GET ?month=YYYY-MM → that month's run + payslips; no month → recent runs.
export const GET = withApi(async (request) => {
  const actor = await requireActor();
  const { month } = parse(payrollQuery, Object.fromEntries(request.nextUrl.searchParams));
  if (month) return Response.json(await getRunForMonth(actor, month));
  return Response.json({ runs: await listRuns(actor) });
});

// HR: create or regenerate the month's draft.
export const POST = withApi(async (request) => {
  const actor = await requireActor();
  const { month } = parse(payrollGenerateSchema, await readJson(request));
  return Response.json(await generateDraft(actor, month), { status: 201 });
});
