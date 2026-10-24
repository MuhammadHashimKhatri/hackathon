import { parse, readJson, withApi } from "@/server/http";
import { requireActor } from "@/server/auth/guard";
import { decideCorrection } from "@/server/services/corrections";
import { correctionDecisionSchema } from "@/lib/validation/attendance";

export const POST = withApi(async (request, { params }) => {
  const actor = await requireActor();
  const { id } = await params;
  const input = parse(correctionDecisionSchema, await readJson(request));
  return Response.json({ correction: await decideCorrection(actor, id, input) });
});
