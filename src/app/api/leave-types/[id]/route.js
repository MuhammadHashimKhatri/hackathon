import { parse, readJson, withApi } from "@/server/http";
import { requireActor } from "@/server/auth/guard";
import { deleteLeaveType, updateLeaveType } from "@/server/services/leaveTypes";
import { leaveTypeUpdateSchema } from "@/lib/validation/organization";

export const PATCH = withApi(async (request, { params }) => {
  const actor = await requireActor();
  const { id } = await params;
  const input = parse(leaveTypeUpdateSchema, await readJson(request));
  return Response.json({ leaveType: await updateLeaveType(actor, id, input) });
});

export const DELETE = withApi(async (_request, { params }) => {
  const actor = await requireActor();
  const { id } = await params;
  return Response.json(await deleteLeaveType(actor, id));
});
