import { withApi } from "@/server/http";
import { requireActor } from "@/server/auth/guard";
import { cancelLeave } from "@/server/services/leave";

export const POST = withApi(async (_request, { params }) => {
  const actor = await requireActor();
  const { id } = await params;
  return Response.json({ request: await cancelLeave(actor, id) });
});
