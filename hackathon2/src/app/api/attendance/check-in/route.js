import { parse, readJson, withApi } from "@/server/http";
import { requireActor } from "@/server/auth/guard";
import { checkIn } from "@/server/services/attendance";
import { checkInSchema } from "@/lib/validation/attendance";

// The server stamps the time; the body only carries optional location.
export const POST = withApi(async (request) => {
  const actor = await requireActor();
  const input = parse(checkInSchema, await readJson(request));
  return Response.json({ attendance: await checkIn(actor, input) }, { status: 201 });
});
