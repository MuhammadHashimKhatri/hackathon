import "server-only";
import { getDb } from "@/server/db";

// Append-only audit trail. Call on every create/update/approve/reject/finalize.
// Never put passwords or tokens in before/after.
export async function audit(actor, action, entity, entityId, before = null, after = null) {
  const { error } = await getDb()
    .from("audit_logs")
    .insert({
      actor_id: actor?.userId ?? null,
      actor_role: actor?.role ?? null,
      action,
      entity,
      entity_id: entityId == null ? null : String(entityId),
      before,
      after,
    });
  if (error) {
    console.error("audit failed", { action, entity, entityId, error });
    throw error;
  }
}
