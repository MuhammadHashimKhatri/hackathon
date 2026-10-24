import { parse, readJson, withApi } from "@/server/http";
import { requireActor } from "@/server/auth/guard";
import { changePassword } from "@/server/services/auth";
import { changePasswordApiSchema } from "@/lib/validation/auth";

export const POST = withApi(async (request) => {
  const actor = await requireActor();
  const input = parse(changePasswordApiSchema, await readJson(request));
  return Response.json(await changePassword(actor, input));
});
