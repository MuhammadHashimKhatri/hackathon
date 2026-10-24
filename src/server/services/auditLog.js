import "server-only";
import { getDb } from "@/server/db";
import { requireRole } from "@/server/auth/guard";

// Audit log viewer (Spec §4 row 25): Admin only, read only. Rows are
// append-only in the DB (trigger), so there is nothing to edit or delete.

const COLUMNS = "id, actor_id, actor_role, action, entity, entity_id, before, after, created_at";

const toEntry = (row, emails) => ({
  id: row.id,
  actorEmail: emails.get(row.actor_id) ?? null,
  actorRole: row.actor_role,
  action: row.action,
  entity: row.entity,
  entityId: row.entity_id,
  before: row.before,
  after: row.after,
  createdAt: row.created_at,
});

// actor_id has no FK (audit rows outlive deleted logins), so emails are looked up.
async function emailsOf() {
  const { data, error } = await getDb().from("app_users").select("id, email");
  if (error) throw error;
  return new Map(data.map((u) => [u.id, u.email]));
}

export async function listAudit(actor, { action, entity, actorId, from, to, page = 1, pageSize = 50 } = {}) {
  requireRole(actor, "admin");
  let query = getDb().from("audit_logs").select(COLUMNS, { count: "exact" });
  if (action) query = query.eq("action", action);
  if (entity) query = query.eq("entity", entity);
  if (actorId) query = query.eq("actor_id", actorId);
  if (from) query = query.gte("created_at", `${from}T00:00:00Z`);
  if (to) query = query.lte("created_at", `${to}T23:59:59Z`);
  const start = (page - 1) * pageSize;
  const emails = await emailsOf();
  const { data, error, count } = await query.order("created_at", { ascending: false }).range(start, start + pageSize - 1);
  if (error) throw error;
  return { rows: data.map((r) => toEntry(r, emails)), total: count ?? 0, page, pageSize };
}

// Distinct values for the filter selects.
export async function auditFacets(actor) {
  requireRole(actor, "admin");
  const db = getDb();
  const [{ data: rows, error }, { data: users, error: usersError }] = await Promise.all([
    db.from("audit_logs").select("action, entity").order("created_at", { ascending: false }).limit(1000),
    db.from("app_users").select("id, email").order("email"),
  ]);
  if (error) throw error;
  if (usersError) throw usersError;
  return {
    actions: [...new Set(rows.map((r) => r.action))].sort(),
    entities: [...new Set(rows.map((r) => r.entity))].sort(),
    actors: users,
  };
}
