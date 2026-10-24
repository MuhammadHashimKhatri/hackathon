import "server-only";
import { getDb } from "@/server/db";
import { AppError } from "@/server/errors";
import { audit } from "@/server/audit";
import { createAuthUser, deleteAuthUser } from "@/server/auth/authAdmin";

const alreadyDone = () => new AppError(409, "SETUP_COMPLETED", "Setup has already been completed.");

export async function getSetupStatus() {
  const { data, error } = await getDb().from("company_settings").select("setup_completed").eq("id", 1).maybeSingle();
  if (error) throw error;
  const setupCompleted = Boolean(data?.setup_completed);
  return {
    setupCompleted,
    // Hints only before setup; the env password itself never leaves the server.
    suggestedEmail: setupCompleted ? null : process.env.ADMIN_EMAIL?.trim().toLowerCase() || null,
    envPasswordAvailable: !setupCompleted && Boolean(process.env.ADMIN_PASSWORD),
  };
}

// First-run setup: auth user (email confirmed) + admin app_users row + company_settings.
// input is already validated by setupSchema.
export async function completeSetup({ companyName, adminEmail, adminPassword }) {
  const status = await getSetupStatus();
  if (status.setupCompleted) throw alreadyDone();

  const password = adminPassword ?? process.env.ADMIN_PASSWORD;
  if (!password || password.length < 8) {
    throw new AppError(422, "VALIDATION_ERROR", "Invalid input", {
      fieldErrors: { adminPassword: ["Use at least 8 characters"] },
    });
  }

  const user = await createAuthUser({ email: adminEmail, password });

  const { error } = await getDb().rpc("fn_complete_setup", {
    p_user_id: user.id,
    p_email: adminEmail,
    p_company: companyName,
  });
  if (error) {
    // Don't leave an orphan login behind (e.g. two setups racing).
    await deleteAuthUser(user.id).catch((e) => console.error("setup rollback failed", e));
    if (error.message === "setup_already_completed") throw alreadyDone();
    throw error;
  }

  await audit({ userId: user.id, role: "admin" }, "create", "company_settings", 1, null, {
    company_name: companyName,
    admin_email: adminEmail,
  });

  return { ok: true };
}
