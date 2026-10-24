import { parse, readJson, withApi } from "@/server/http";
import { requireActor } from "@/server/auth/guard";
import { deleteDepartment, renameDepartment } from "@/server/services/organization";
import { departmentSchema } from "@/lib/validation/organization";

export const PATCH = withApi(async (request, { params }) => {
  const actor = await requireActor();
  const { id } = await params;
  const input = parse(departmentSchema, await readJson(request));
  return Response.json({ department: await renameDepartment(actor, id, input) });
});

export const DELETE = withApi(async (_request, { params }) => {
  const actor = await requireActor();
  const { id } = await params;
  return Response.json(await deleteDepartment(actor, id));
});
