import { parse, withApi } from "@/server/http";
import { requireActor } from "@/server/auth/guard";
import { getCalendar } from "@/server/services/attendance";
import { monthQuery } from "@/lib/validation/attendance";

// Admin/HR: anyone's month. An Employee may only ask for their own id (403).
export const GET = withApi(async (request, { params }) => {
  const actor = await requireActor();
  const { id } = await params;
  const query = parse(monthQuery, Object.fromEntries(request.nextUrl.searchParams));
  return Response.json(await getCalendar(actor, query, id));
});
