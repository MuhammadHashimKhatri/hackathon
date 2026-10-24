import "server-only";
import { z } from "zod";
import { getDb } from "@/server/db";
import { notFound } from "@/server/errors";
import { audit } from "@/server/audit";
import { requireRole } from "@/server/auth/guard";
import { check } from "@/server/dbErrors";

// Company holidays. Spec §4 row 04: Admin manages, HR views.
// Working days (Spec §6) are derived from this calendar at query time.

const DUPLICATE = { unique: "There's already a holiday on that date." };

export async function listHolidays(actor, { year }) {
  requireRole(actor, "admin", "hr");
  const { data, error } = await getDb()
    .from("holidays")
    .select("id, date, name")
    .gte("date", `${year}-01-01`)
    .lte("date", `${year}-12-31`)
    .order("date");
  if (error) throw error;
  return data;
}

// Years that have at least one holiday, for the year selector.
export async function listHolidayYears(actor) {
  requireRole(actor, "admin", "hr");
  const { data, error } = await getDb().from("holidays").select("date");
  if (error) throw error;
  return [...new Set(data.map((h) => Number(h.date.slice(0, 4))))].sort();
}

async function findHoliday(id) {
  if (!z.uuid().safeParse(id).success) throw notFound("Holiday not found.");
  const { data, error } = await getDb().from("holidays").select("id, date, name").eq("id", id).maybeSingle();
  if (error) throw error;
  if (!data) throw notFound("Holiday not found.");
  return data;
}

export async function createHoliday(actor, { date, name }) {
  requireRole(actor, "admin");
  const { data, error } = await getDb().from("holidays").insert({ date, name }).select("id, date, name").single();
  check(error, DUPLICATE);
  await audit(actor, "create", "holidays", data.id, null, { date, name });
  return data;
}

export async function updateHoliday(actor, id, { date, name }) {
  requireRole(actor, "admin");
  const before = await findHoliday(id);
  const { data, error } = await getDb().from("holidays").update({ date, name }).eq("id", id).select("id, date, name").single();
  check(error, DUPLICATE);
  await audit(actor, "update", "holidays", id, { date: before.date, name: before.name }, { date, name });
  return data;
}

export async function deleteHoliday(actor, id) {
  requireRole(actor, "admin");
  const before = await findHoliday(id);
  const { error } = await getDb().from("holidays").delete().eq("id", id);
  if (error) throw error;
  await audit(actor, "delete", "holidays", id, { date: before.date, name: before.name }, null);
  return { ok: true };
}
