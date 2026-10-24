import { parse, readJson, withApi } from "@/server/http";
import { requireActor } from "@/server/auth/guard";
import { listAnnouncements, postAnnouncement } from "@/server/services/announcements";
import { announcementSchema } from "@/lib/validation/dashboard";

export const GET = withApi(async () => {
  const actor = await requireActor();
  return Response.json({ announcements: await listAnnouncements(actor) });
});

export const POST = withApi(async (request) => {
  const actor = await requireActor();
  const input = parse(announcementSchema, await readJson(request));
  return Response.json({ announcement: await postAnnouncement(actor, input) }, { status: 201 });
});
