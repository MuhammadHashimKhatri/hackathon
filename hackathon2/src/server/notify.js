import "server-only";
import { getDb } from "@/server/db";

// In-app notification for one login (shown by the bell in Prompt 11).
export async function notify(userId, type, title, body = null, link = null) {
  const { error } = await getDb().from("notifications").insert({ user_id: userId, type, title, body, link });
  if (error) {
    console.error("notify failed", { userId, type, error });
    throw error;
  }
}
