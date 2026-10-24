import "server-only";
import { getDb } from "@/server/db";
import { AppError, unauthorized } from "@/server/errors";
import { audit } from "@/server/audit";
import { setAuthPassword, verifyPassword } from "@/server/auth/authAdmin";

// Any signed-in user, including one forced here by must_change_password.
export async function changePassword(actor, { currentPassword, newPassword }) {
  if (!actor) throw unauthorized();

  if (!(await verifyPassword(actor.email, currentPassword))) {
    throw new AppError(422, "VALIDATION_ERROR", "Current password is incorrect.", {
      fieldErrors: { currentPassword: ["Current password is incorrect"] },
    });
  }

  await setAuthPassword(actor.userId, newPassword);

  const { error } = await getDb().from("app_users").update({ must_change_password: false }).eq("id", actor.userId);
  if (error) throw error;

  await audit(actor, "change_password", "app_users", actor.userId,
    { must_change_password: actor.mustChangePassword },
    { must_change_password: false });

  return { ok: true };
}
