import { AppError, conflict } from "@/server/errors";

// Postgres errors that are the user's business, not ours:
//   23505 unique_violation      -> 409 with `unique` message
//   23503 foreign_key_violation -> 422 with `foreignKey` message
// Anything else is rethrown (and becomes a generic 500).
export function mapDbError(err, { unique, foreignKey } = {}) {
  if (err?.code === "23505" && unique) return conflict(unique);
  if (err?.code === "23503" && foreignKey) return new AppError(422, "IN_USE", foreignKey);
  return err;
}

// Throw the mapped error if the Supabase call failed.
export function check(error, messages) {
  if (error) throw mapDbError(error, messages);
}
