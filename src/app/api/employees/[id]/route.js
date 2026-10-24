import { readJson, withApi } from "@/server/http";
import { requireActor } from "@/server/auth/guard";
import { getEmployee360, updateEmployee } from "@/server/services/employees";

// Employee 360. An Employee asking for anyone else's id gets 403.
export const GET = withApi(async (_request, { params }) => {
  const actor = await requireActor();
  const { id } = await params;
  return Response.json(await getEmployee360(actor, id));
});

// HR: job fields; Employee: own phone & address (the service picks the schema by role).
export const PATCH = withApi(async (request, { params }) => {
  const actor = await requireActor();
  const { id } = await params;
  return Response.json({ employee: await updateEmployee(actor, id, await readJson(request)) });
});
