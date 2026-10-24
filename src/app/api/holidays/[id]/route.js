import { parse, readJson, withApi } from "@/server/http";
import { requireActor } from "@/server/auth/guard";
import { deleteHoliday, updateHoliday } from "@/server/services/holidays";
import { holidaySchema } from "@/lib/validation/organization";

export const PATCH = withApi(async (request, { params }) => {
  const actor = await requireActor();
  const { id } = await params;
  const input = parse(holidaySchema, await readJson(request));
  return Response.json({ holiday: await updateHoliday(actor, id, input) });
});

export const DELETE = withApi(async (_request, { params }) => {
  const actor = await requireActor();
  const { id } = await params;
  return Response.json(await deleteHoliday(actor, id));
});
