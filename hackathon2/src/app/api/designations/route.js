import { z } from "zod";
import { parse, readJson, withApi } from "@/server/http";
import { requireActor } from "@/server/auth/guard";
import { createDesignation, listDesignations } from "@/server/services/organization";
import { designationSchema } from "@/lib/validation/organization";

const listQuery = z.object({ departmentId: z.uuid().optional() });

export const GET = withApi(async (request) => {
  const actor = await requireActor();
  const query = parse(listQuery, Object.fromEntries(request.nextUrl.searchParams));
  return Response.json({ designations: await listDesignations(actor, query) });
});

export const POST = withApi(async (request) => {
  const actor = await requireActor();
  const input = parse(designationSchema, await readJson(request));
  return Response.json({ designation: await createDesignation(actor, input) }, { status: 201 });
});
