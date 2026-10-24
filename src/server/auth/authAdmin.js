import "server-only";
import { createClient } from "@supabase/supabase-js";
import { getDb } from "@/server/db";
import { conflict } from "@/server/errors";

// Supabase Auth admin calls (secret key). Ban length used for "deactivated".
const BAN_FOREVER = "876000h";

const admin = () => getDb().auth.admin;

export async function createAuthUser({ email, password }) {
  const { data, error } = await admin().createUser({ email, password, email_confirm: true });
  if (error) {
    if (error.code === "email_exists" || /already (been )?registered|already exists/i.test(error.message)) {
      throw conflict("A login with this email already exists.");
    }
    throw error;
  }
  return data.user;
}

export async function deleteAuthUser(id) {
  const { error } = await admin().deleteUser(id);
  if (error) throw error;
}

export async function setAuthPassword(id, password) {
  const { error } = await admin().updateUserById(id, { password });
  if (error) throw error;
}

// Banned users can't sign in or refresh a session.
export async function setAuthBanned(id, banned) {
  const { error } = await admin().updateUserById(id, { ban_duration: banned ? BAN_FOREVER : "none" });
  if (error) throw error;
}

// Checks a password without touching the caller's session cookies.
export async function verifyPassword(email, password) {
  const client = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
  const { error } = await client.auth.signInWithPassword({ email, password });
  if (error) return false;
  await client.auth.signOut({ scope: "local" });
  return true;
}
