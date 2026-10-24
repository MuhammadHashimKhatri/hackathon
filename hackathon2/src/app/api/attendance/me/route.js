import { parse, withApi } from "@/server/http";
import { requireActor } from "@/server/auth/guard";
import { getCalendar } from "@/server/services/attendance";
import { monthQuery } from "@/lib/validation/attendance";

export const GET = withApi(async (request) => {
  const actor = await requireActor();
  const query = parse(monthQuery, Object.fromEntries(request.nextUrl.searchParams));
  return Response.json(await getCalendar(actor, query));
});
