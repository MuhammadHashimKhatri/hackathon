import { readJson, withApi } from "@/server/http";
import { requireActor } from "@/server/auth/guard";
import { exitEmployee } from "@/server/services/employees";

export const POST = withApi(async (request, { params }) => {
  const actor = await requireActor();
  const { id } = await params;
  return Response.json(await exitEmployee(actor, id, await readJson(request)));
});
