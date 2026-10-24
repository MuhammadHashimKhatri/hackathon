import { parse, readJson, withApi } from "@/server/http";
import { requireActor } from "@/server/auth/guard";
import { summarizeDashboard } from "@/server/services/ai";
import { summarySchema } from "@/lib/validation/ai";

export const POST = withApi(async (request) => {
  const actor = await requireActor();
  return Response.json(await summarizeDashboard(actor, parse(summarySchema, await readJson(request))));
});
