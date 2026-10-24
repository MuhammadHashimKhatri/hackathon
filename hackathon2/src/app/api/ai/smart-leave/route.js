import { parse, readJson, withApi } from "@/server/http";
import { requireActor } from "@/server/auth/guard";
import { smartLeave } from "@/server/services/ai";
import { smartLeaveSchema } from "@/lib/validation/ai";

export const POST = withApi(async (request) => {
  const actor = await requireActor();
  return Response.json(await smartLeave(actor, parse(smartLeaveSchema, await readJson(request))));
});
