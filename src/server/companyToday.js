import "server-only";
import { getDb } from "@/server/db";

// Today's date ("YYYY-MM-DD") in the company time zone (Spec §6).
export async function companyToday() {
  const { data, error } = await getDb().rpc("fn_company_today");
  if (error) throw error;
  return data;
}
