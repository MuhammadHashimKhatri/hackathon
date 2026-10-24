import { parse, readJson, withApi } from "@/server/http";
import { completeSetup } from "@/server/services/setup";
import { setupSchema } from "@/lib/validation/auth";

// Public, but only works once: 409 after setup is done.
export const POST = withApi(async (request) => {
  const input = parse(setupSchema, await readJson(request));
  return Response.json(await completeSetup(input), { status: 201 });
});
