import { parse, withApi } from "@/server/http";
import { requireActor } from "@/server/auth/guard";
import { listAudit } from "@/server/services/auditLog";
import { auditQuery } from "@/lib/validation/dashboard";

// Admin only (the service checks). Read only: there is no write route.
export const GET = withApi(async (request) => {
  const actor = await requireActor();
  const q = parse(auditQuery, Object.fromEntries(request.nextUrl.searchParams));
  return Response.json(await listAudit(actor, { ...q, actorId: q.actor }));
});
