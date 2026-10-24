import { z } from "zod";
import { parse, readJson, withApi } from "@/server/http";
import { requireActor } from "@/server/auth/guard";
import { createHoliday, listHolidays } from "@/server/services/holidays";
import { holidaySchema, yearSchema } from "@/lib/validation/organization";

const listQuery = z.object({ year: yearSchema.optional() });

export const GET = withApi(async (request) => {
  const actor = await requireActor();
  const { year = new Date().getFullYear() } = parse(listQuery, Object.fromEntries(request.nextUrl.searchParams));
  return Response.json({ year, holidays: await listHolidays(actor, { year }) });
});

export const POST = withApi(async (request) => {
  const actor = await requireActor();
  const input = parse(holidaySchema, await readJson(request));
  return Response.json({ holiday: await createHoliday(actor, input) }, { status: 201 });
});
