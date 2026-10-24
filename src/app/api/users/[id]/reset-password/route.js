import { withApi } from "@/server/http";
import { requireActor } from "@/server/auth/guard";
import { resetPassword } from "@/server/services/users";

export const POST = withApi(async (_request, { params }) => {
  const actor = await requireActor();
  const { id } = await params;
  return Response.json(await resetPassword(actor, id));
});
