import { z } from "zod";
import { parse, readJson, withApi } from "@/server/http";
import { requireActor } from "@/server/auth/guard";
import { createHrUser, listUsers } from "@/server/services/users";
import { createHrUserSchema } from "@/lib/validation/auth";

const listQuery = z.object({
  role: z.enum(["admin", "hr", "employee"]).optional(),
  q: z.string().trim().max(100).optional(),
});

export const GET = withApi(async (request) => {
  const actor = await requireActor();
  const params = Object.fromEntries(request.nextUrl.searchParams);
  const users = await listUsers(actor, parse(listQuery, params));
  return Response.json({ users });
});

export const POST = withApi(async (request) => {
  const actor = await requireActor();
  const input = parse(createHrUserSchema, await readJson(request));
  return Response.json(await createHrUser(actor, input), { status: 201 });
});
