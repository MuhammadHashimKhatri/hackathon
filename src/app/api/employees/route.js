import { parse, readJson, withApi } from "@/server/http";
import { requireActor } from "@/server/auth/guard";
import { listEmployees, registerEmployee } from "@/server/services/employees";
import { listEmployeesQuery } from "@/lib/validation/employees";

export const GET = withApi(async (request) => {
  const actor = await requireActor();
  const query = parse(listEmployeesQuery, Object.fromEntries(request.nextUrl.searchParams));
  const { rows, ...page } = await listEmployees(actor, query);
  return Response.json({ employees: rows, ...page });
});

// Body is validated by the service (registerEmployeeSchema).
export const POST = withApi(async (request) => {
  const actor = await requireActor();
  return Response.json(await registerEmployee(actor, await readJson(request)), { status: 201 });
});
