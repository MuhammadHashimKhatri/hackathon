import { parse, readJson, withApi } from "@/server/http";
import { requireActor } from "@/server/auth/guard";
import { deleteDesignation, updateDesignation } from "@/server/services/organization";
import { designationSchema } from "@/lib/validation/organization";

export const PATCH = withApi(async (request, { params }) => {
  const actor = await requireActor();
  const { id } = await params;
  const input = parse(designationSchema, await readJson(request));
  return Response.json({ designation: await updateDesignation(actor, id, input) });
});

export const DELETE = withApi(async (_request, { params }) => {
  const actor = await requireActor();
  const { id } = await params;
  return Response.json(await deleteDesignation(actor, id));
});
