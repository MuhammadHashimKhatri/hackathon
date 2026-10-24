import { parse, readJson, withApi } from "@/server/http";
import { requireActor } from "@/server/auth/guard";
import { decideLeave } from "@/server/services/leave";
import { leaveDecisionSchema } from "@/lib/validation/leave";

export const POST = withApi(async (request, { params }) => {
  const actor = await requireActor();
  const { id } = await params;
  const input = parse(leaveDecisionSchema, await readJson(request));
  return Response.json({ request: await decideLeave(actor, id, input) });
});
