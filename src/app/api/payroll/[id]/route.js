import { withApi } from "@/server/http";
import { requireActor } from "@/server/auth/guard";
import { getRun } from "@/server/services/payroll";

export const GET = withApi(async (_request, { params }) => {
  const actor = await requireActor();
  const { id } = await params;
  return Response.json(await getRun(actor, id));
});
