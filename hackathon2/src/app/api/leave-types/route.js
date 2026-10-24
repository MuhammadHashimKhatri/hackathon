import { parse, readJson, withApi } from "@/server/http";
import { requireActor } from "@/server/auth/guard";
import { createLeaveType, listLeaveTypes } from "@/server/services/leaveTypes";
import { leaveTypeCreateSchema } from "@/lib/validation/organization";

export const GET = withApi(async () => {
  const actor = await requireActor();
  return Response.json({ leaveTypes: await listLeaveTypes(actor) });
});

export const POST = withApi(async (request) => {
  const actor = await requireActor();
  const input = parse(leaveTypeCreateSchema, await readJson(request));
  return Response.json({ leaveType: await createLeaveType(actor, input) }, { status: 201 });
});
