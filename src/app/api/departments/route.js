import { parse, readJson, withApi } from "@/server/http";
import { requireActor } from "@/server/auth/guard";
import { createDepartment, listOrganization } from "@/server/services/organization";
import { departmentSchema } from "@/lib/validation/organization";

// GET returns departments with their designations and counts.
export const GET = withApi(async () => {
  const actor = await requireActor();
  return Response.json(await listOrganization(actor));
});

export const POST = withApi(async (request) => {
  const actor = await requireActor();
  const input = parse(departmentSchema, await readJson(request));
  return Response.json({ department: await createDepartment(actor, input) }, { status: 201 });
});
