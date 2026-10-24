import "server-only";
import { getDb } from "@/server/db";
import { audit } from "@/server/audit";
import { notify } from "@/server/notify";
import { requireRole } from "@/server/auth/guard";

// Announcements (Spec §4 row 23): Admin and HR post, everyone reads.

const COLUMNS = "id, title, body, created_at, author:app_users(email, role)";

const toAnnouncement = (row) => ({
  id: row.id,
  title: row.title,
  body: row.body,
  createdAt: row.created_at,
  authorEmail: row.author?.email ?? null,
  authorRole: row.author?.role ?? null,
});

export async function listAnnouncements(actor, { limit = 50 } = {}) {
  requireRole(actor, "admin", "hr", "employee");
  const { data, error } = await getDb().from("announcements").select(COLUMNS).order("created_at", { ascending: false }).limit(limit);
  if (error) throw error;
  return data.map(toAnnouncement);
}

export async function postAnnouncement(actor, { title, body }) {
  requireRole(actor, "admin", "hr");
  const db = getDb();
  const { data, error } = await db
    .from("announcements")
    .insert({ title, body, author_id: actor.userId })
    .select(COLUMNS)
    .single();
  if (error) throw error;
  await audit(actor, "create", "announcements", data.id, null, { title });

  const { data: users, error: usersError } = await db.from("app_users").select("id").eq("is_active", true).neq("id", actor.userId);
  if (usersError) throw usersError;
  await Promise.all(users.map((u) => notify(u.id, "announcement", `New announcement: ${title}`, null, "/announcements")));
  return toAnnouncement(data);
}
