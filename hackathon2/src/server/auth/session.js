import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { getDb } from "@/server/db";
import { createClient } from "@/server/supabase/sessionClient";

// The current user, or null when signed out / no app_users row / deactivated.
// cache(): read once per request even when layout, menu and page all ask.
// Reads cookies, so callers must render inside <Suspense>.
export const getActor = cache(async () => {
  // Supabase compares the token expiry with Date.now(). connection() stops any
  // prerender here, so that clock read (and every "today" computed after the
  // session check) only ever happens at request time.
  await connection();
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub;
  if (!userId) return null;

  const { data: row, error } = await getDb()
    .from("app_users")
    .select("id, email, role, employee_id, is_active, must_change_password")
    .eq("id", userId)
    .maybeSingle();
  if (error) throw error;
  if (!row || !row.is_active) return null;

  return {
    userId: row.id,
    email: row.email,
    role: row.role,
    employeeId: row.employee_id,
    isActive: row.is_active,
    mustChangePassword: row.must_change_password,
  };
});

// Pages only: signed-out visitors go to /login and flagged users to
// /change-password (the proxy does the same; this is the second line).
export async function getPageActor() {
  const actor = await getActor();
  if (!actor) redirect("/login");
  if (actor.mustChangePassword) redirect("/change-password");
  return actor;
}
