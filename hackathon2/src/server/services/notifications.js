import "server-only";
import { z } from "zod";
import { getDb } from "@/server/db";
import { requireRole } from "@/server/auth/guard";

// In-app notifications (Spec §4 row 24): every login only sees its own.

const toNotification = (row) => ({
  id: row.id,
  type: row.type,
  title: row.title,
  body: row.body,
  link: row.link,
  readAt: row.read_at,
  createdAt: row.created_at,
});

export async function listMyNotifications(actor, { limit = 20 } = {}) {
  requireRole(actor, "admin", "hr", "employee");
  const db = getDb();
  const [{ data, error }, unread] = await Promise.all([
    db.from("notifications").select("id, type, title, body, link, read_at, created_at").eq("user_id", actor.userId).order("created_at", { ascending: false }).limit(limit),
    db.from("notifications").select("id", { count: "exact", head: true }).eq("user_id", actor.userId).is("read_at", null),
  ]);
  if (error) throw error;
  if (unread.error) throw unread.error;
  return { items: data.map(toNotification), unread: unread.count ?? 0 };
}

// ids omitted = mark all of the user's notifications read.
export async function markRead(actor, { ids } = {}) {
  requireRole(actor, "admin", "hr", "employee");
  let query = getDb().from("notifications").update({ read_at: new Date().toISOString() }).eq("user_id", actor.userId).is("read_at", null);
  if (ids?.length) query = query.in("id", ids.filter((id) => z.uuid().safeParse(id).success));
  const { error } = await query;
  if (error) throw error;
  return listMyNotifications(actor);
}
