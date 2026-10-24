import { withApi } from "@/server/http";
import { requireActor } from "@/server/auth/guard";
import { listMyNotifications } from "@/server/services/notifications";

export const GET = withApi(async () => {
  const actor = await requireActor();
  return Response.json(await listMyNotifications(actor));
});
