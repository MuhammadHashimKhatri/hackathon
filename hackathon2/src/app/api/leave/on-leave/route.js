import { parse, withApi } from "@/server/http";
import { requireActor } from "@/server/auth/guard";
import { whoIsOnLeave } from "@/server/services/leave";
import { onLeaveQuery } from "@/lib/validation/leave";

export const GET = withApi(async (request) => {
  const actor = await requireActor();
  const query = parse(onLeaveQuery, Object.fromEntries(request.nextUrl.searchParams));
  return Response.json({ requests: await whoIsOnLeave(actor, query) });
});
