import { parse, readJson, withApi } from "@/server/http";
import { requireActor } from "@/server/auth/guard";
import { listCorrections, requestCorrection } from "@/server/services/corrections";
import { correctionListQuery, correctionRequestSchema } from "@/lib/validation/attendance";

export const GET = withApi(async (request) => {
  const actor = await requireActor();
  const query = parse(correctionListQuery, Object.fromEntries(request.nextUrl.searchParams));
  return Response.json({ corrections: await listCorrections(actor, query) });
});

export const POST = withApi(async (request) => {
  const actor = await requireActor();
  const input = parse(correctionRequestSchema, await readJson(request));
  return Response.json({ correction: await requestCorrection(actor, input) }, { status: 201 });
});
