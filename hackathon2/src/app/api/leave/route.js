import { parse, readJson, withApi } from "@/server/http";
import { requireActor } from "@/server/auth/guard";
import { applyLeave, listLeave, listMyLeave } from "@/server/services/leave";
import { leaveApplySchema, leaveListQuery, yearQuery } from "@/lib/validation/leave";

// Admin/HR: everyone's requests (filters). Employee: their own history.
export const GET = withApi(async (request) => {
  const actor = await requireActor();
  const params = Object.fromEntries(request.nextUrl.searchParams);
  if (actor.role === "employee") {
    return Response.json({ requests: await listMyLeave(actor, parse(yearQuery, params)) });
  }
  return Response.json({ requests: await listLeave(actor, parse(leaveListQuery, params)) });
});

export const POST = withApi(async (request) => {
  const actor = await requireActor();
  const input = parse(leaveApplySchema, await readJson(request));
  return Response.json({ request: await applyLeave(actor, input) }, { status: 201 });
});
