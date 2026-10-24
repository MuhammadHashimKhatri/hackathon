import { parse, readJson, withApi } from "@/server/http";
import { requireActor } from "@/server/auth/guard";
import { chat } from "@/server/services/ai";
import { chatSchema } from "@/lib/validation/ai";

export const POST = withApi(async (request) => {
  const actor = await requireActor();
  return Response.json(await chat(actor, parse(chatSchema, await readJson(request))));
});
