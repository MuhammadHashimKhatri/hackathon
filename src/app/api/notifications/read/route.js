import { z } from "zod";
import { parse, readJson, withApi } from "@/server/http";
import { requireActor } from "@/server/auth/guard";
import { markRead } from "@/server/services/notifications";

const schema = z.strictObject({ ids: z.array(z.uuid()).max(100).optional() });

// { ids } marks those read; {} marks all read.
export const POST = withApi(async (request) => {
  const actor = await requireActor();
  return Response.json(await markRead(actor, parse(schema, await readJson(request))));
});
