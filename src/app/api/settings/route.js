import { parse, readJson, withApi } from "@/server/http";
import { requireActor } from "@/server/auth/guard";
import { getSettings, updateSettings } from "@/server/services/settings";
import { settingsSchema } from "@/lib/validation/organization";

export const GET = withApi(async () => {
  const actor = await requireActor();
  return Response.json({ settings: await getSettings(actor) });
});

export const PATCH = withApi(async (request) => {
  const actor = await requireActor();
  const input = parse(settingsSchema, await readJson(request));
  return Response.json({ settings: await updateSettings(actor, input) });
});
