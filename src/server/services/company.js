import "server-only";
import { getDb } from "@/server/db";

// Shown in the topbar to every signed-in user.
export async function getCompanyName() {
  const { data, error } = await getDb().from("company_settings").select("company_name").eq("id", 1).maybeSingle();
  if (error) throw error;
  return data?.company_name ?? null;
}
