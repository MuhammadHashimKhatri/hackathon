import { parse, withApi } from "@/server/http";
import { requireActor } from "@/server/auth/guard";
import { dailyBoard } from "@/server/services/attendance";
import { boardQuery } from "@/lib/validation/attendance";

export const GET = withApi(async (request) => {
  const actor = await requireActor();
  const query = parse(boardQuery, Object.fromEntries(request.nextUrl.searchParams));
  return Response.json(await dailyBoard(actor, query));
});
