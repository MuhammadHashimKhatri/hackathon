import { parse, withApi } from "@/server/http";
import { requireActor } from "@/server/auth/guard";
import { getMyBalances } from "@/server/services/leave";
import { yearQuery } from "@/lib/validation/leave";

// Own balances only; HR/Admin see other people's in Employee 360.
export const GET = withApi(async (request) => {
  const actor = await requireActor();
  const { year } = parse(yearQuery, Object.fromEntries(request.nextUrl.searchParams));
  return Response.json({ balances: await getMyBalances(actor, year) });
});
