import { withApi } from "@/server/http";
import { requireActor } from "@/server/auth/guard";
import { finalizeRun } from "@/server/services/payroll";

export const POST = withApi(async (_request, { params }) => {
  const actor = await requireActor();
  const { id } = await params;
  return Response.json(await finalizeRun(actor, id));
});
