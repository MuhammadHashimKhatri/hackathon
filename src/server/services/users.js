import "server-only";
import { z } from "zod";
import { getDb } from "@/server/db";
import { AppError, conflict, notFound } from "@/server/errors";
import { audit } from "@/server/audit";
import { requireRole } from "@/server/auth/guard";
import { createAuthUser, deleteAuthUser, setAuthBanned, setAuthPassword } from "@/server/auth/authAdmin";
import { generateTempPassword } from "@/server/auth/tempPassword";

// Admin-only login management (Spec §4 functionality 05).

const COLUMNS = "id, email, role, is_active, must_change_password, employee_id, created_at";

function toUser(row) {
  return {
    id: row.id,
    email: row.email,
    role: row.role,
    isActive: row.is_active,
    mustChangePassword: row.must_change_password,
    employeeId: row.employee_id,
    createdAt: row.created_at,
  };
}

async function findUser(id) {
  if (!z.uuid().safeParse(id).success) throw notFound("Login not found.");
  const { data, error } = await getDb().from("app_users").select(COLUMNS).eq("id", id).maybeSingle();
  if (error) throw error;
  if (!data) throw notFound("Login not found.");
  return data;
}

const notOnSelf = (message) => new AppError(422, "SELF_ACTION", message);

export async function listUsers(actor, { role, q } = {}) {
  requireRole(actor, "admin");
  let query = getDb().from("app_users").select(COLUMNS).order("created_at", { ascending: true });
  if (role) query = query.eq("role", role);
  if (q) query = query.ilike("email", `%${q.replace(/[\\%_]/g, (c) => `\\${c}`)}%`);
  const { data, error } = await query;
  if (error) throw error;
  return data.map(toUser);
}

// HR logins only: admins come from /setup, employee logins from employee registration.
export async function createHrUser(actor, { email }) {
  requireRole(actor, "admin");
  const tempPassword = generateTempPassword();
  const authUser = await createAuthUser({ email, password: tempPassword });

  const { data, error } = await getDb()
    .from("app_users")
    .insert({ id: authUser.id, email: email.toLowerCase(), role: "hr", must_change_password: true })
    .select(COLUMNS)
    .single();
  if (error) {
    await deleteAuthUser(authUser.id).catch((e) => console.error("create user rollback failed", e));
    if (error.code === "23505") throw conflict("A login with this email already exists.");
    throw error;
  }

  const user = toUser(data);
  await audit(actor, "create", "app_users", user.id, null, { email: user.email, role: user.role });
  return { user, tempPassword };
}

export async function setActive(actor, id, isActive) {
  requireRole(actor, "admin");
  if (id === actor.userId) throw notOnSelf("You can't deactivate your own account.");
  const before = await findUser(id);

  const { data, error } = await getDb().from("app_users").update({ is_active: isActive }).eq("id", id).select(COLUMNS).single();
  if (error) throw error;
  await setAuthBanned(id, !isActive);

  await audit(actor, isActive ? "activate" : "deactivate", "app_users", id,
    { is_active: before.is_active }, { is_active: isActive });
  return toUser(data);
}

export async function resetPassword(actor, id) {
  requireRole(actor, "admin");
  if (id === actor.userId) throw notOnSelf("Use Change password for your own account.");
  const before = await findUser(id);

  const tempPassword = generateTempPassword();
  await setAuthPassword(id, tempPassword);
  const { error } = await getDb().from("app_users").update({ must_change_password: true }).eq("id", id);
  if (error) throw error;

  await audit(actor, "reset_password", "app_users", id,
    { must_change_password: before.must_change_password }, { must_change_password: true });
  return { tempPassword };
}
