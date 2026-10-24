import { parse, readJson, withApi } from "@/server/http";
import { requireActor } from "@/server/auth/guard";
import { setActive } from "@/server/services/users";
import { setActiveSchema } from "@/lib/validation/auth";

export const PATCH = withApi(async (request, { params }) => {
  const actor = await requireActor();
  const { id } = await params;
  const { isActive } = parse(setActiveSchema, await readJson(request));
  return Response.json({ user: await setActive(actor, id, isActive) });
});
