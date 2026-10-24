import "server-only";
import { z } from "zod";
import { getDb } from "@/server/db";
import { notFound } from "@/server/errors";
import { audit } from "@/server/audit";
import { requireRole } from "@/server/auth/guard";
import { check } from "@/server/dbErrors";
import { LEAVE_CODES, STANDARD_LEAVE_TYPES } from "@/lib/validation/organization";

// Leave types & quotas. Spec §4 row 04: Admin manages, HR views.
// yearly_quota null = unlimited.

const COLUMNS = "id, code, name, yearly_quota, is_paid";

function toLeaveType(row) {
  return { id: row.id, code: row.code, name: row.name, yearlyQuota: row.yearly_quota, isPaid: row.is_paid };
}

const byCode = (a, b) => LEAVE_CODES.indexOf(a.code) - LEAVE_CODES.indexOf(b.code);

export async function listLeaveTypes(actor) {
  requireRole(actor, "admin", "hr");
  const { data, error } = await getDb().from("leave_types").select(COLUMNS);
  if (error) throw error;
  return data.map(toLeaveType).sort(byCode);
}

async function findLeaveType(id) {
  if (!z.uuid().safeParse(id).success) throw notFound("Leave type not found.");
  const { data, error } = await getDb().from("leave_types").select(COLUMNS).eq("id", id).maybeSingle();
  if (error) throw error;
  if (!data) throw notFound("Leave type not found.");
  return data;
}

export async function createLeaveType(actor, { code, name, yearlyQuota, isPaid }) {
  requireRole(actor, "admin");
  const row = { code, name, yearly_quota: yearlyQuota, is_paid: isPaid };
  const { data, error } = await getDb().from("leave_types").insert(row).select(COLUMNS).single();
  check(error, { unique: `A ${code} leave type already exists.` });
  await audit(actor, "create", "leave_types", data.id, null, row);
  return toLeaveType(data);
}

export async function updateLeaveType(actor, id, { name, yearlyQuota, isPaid }) {
  requireRole(actor, "admin");
  const before = await findLeaveType(id);
  const changes = { name, yearly_quota: yearlyQuota, is_paid: isPaid };
  const { data, error } = await getDb().from("leave_types").update(changes).eq("id", id).select(COLUMNS).single();
  if (error) throw error;
  await audit(actor, "update", "leave_types", id,
    { name: before.name, yearly_quota: before.yearly_quota, is_paid: before.is_paid }, changes);
  return toLeaveType(data);
}

export async function deleteLeaveType(actor, id) {
  requireRole(actor, "admin");
  const before = await findLeaveType(id);
  const { error } = await getDb().from("leave_types").delete().eq("id", id);
  check(error, { foreignKey: "Leave requests use this type, so it can't be deleted. Change its quota instead." });
  await audit(actor, "delete", "leave_types", id, { code: before.code, name: before.name }, null);
  return { ok: true };
}

// One click: annual 14, sick 8, casual 10, unpaid unlimited — only the missing ones.
// Admin configuration, not sample data (Spec §5 Decision on leave_types).
export async function addStandardLeaveTypes(actor) {
  requireRole(actor, "admin");
  const { data, error } = await getDb()
    .from("leave_types")
    .upsert(STANDARD_LEAVE_TYPES, { onConflict: "code", ignoreDuplicates: true })
    .select(COLUMNS);
  if (error) throw error;
  for (const row of data) {
    await audit(actor, "create", "leave_types", row.id, null,
      { code: row.code, name: row.name, yearly_quota: row.yearly_quota, is_paid: row.is_paid });
  }
  return { added: data.map((r) => r.code).sort((a, b) => LEAVE_CODES.indexOf(a) - LEAVE_CODES.indexOf(b)) };
}
