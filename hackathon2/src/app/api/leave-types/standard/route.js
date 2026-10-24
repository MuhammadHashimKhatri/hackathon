import { withApi } from "@/server/http";
import { requireActor } from "@/server/auth/guard";
import { addStandardLeaveTypes } from "@/server/services/leaveTypes";

// Adds annual 14 / sick 8 / casual 10 / unpaid (unlimited) where missing.
export const POST = withApi(async () => {
  const actor = await requireActor();
  return Response.json(await addStandardLeaveTypes(actor), { status: 201 });
});
