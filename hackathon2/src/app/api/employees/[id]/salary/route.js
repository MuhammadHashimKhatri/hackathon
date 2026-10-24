import { parse, readJson, withApi } from "@/server/http";
import { requireActor } from "@/server/auth/guard";
import { getSalaryHistory, setSalary } from "@/server/services/salary";
import { salarySchema } from "@/lib/validation/employees";

export const GET = withApi(async (_request, { params }) => {
  const actor = await requireActor();
  const { id } = await params;
  return Response.json({ history: await getSalaryHistory(actor, id) });
});

export const POST = withApi(async (request, { params }) => {
  const actor = await requireActor();
  const { id } = await params;
  const input = parse(salarySchema, await readJson(request));
  return Response.json({ salary: await setSalary(actor, id, input) }, { status: 201 });
});
