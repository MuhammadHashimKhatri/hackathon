import { withApi } from "@/server/http";
import { requireActor } from "@/server/auth/guard";
import { checkOut } from "@/server/services/attendance";

export const POST = withApi(async () => {
  const actor = await requireActor();
  return Response.json({ attendance: await checkOut(actor) });
});
