"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getDb } from "@/server/db";
import { createClient } from "@/server/supabase/sessionClient";
import { fieldErrorsOf, loginSchema } from "@/lib/validation/auth";

// useActionState action: returns { values, fieldErrors?, formError? } or redirects.
export async function login(prevState, formData) {
  const values = { email: String(formData.get("email") ?? "") };
  const parsed = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) return { values, fieldErrors: fieldErrorsOf(parsed.error) };

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) {
    // Supabase answers "user_banned" for deactivated logins.
    if (error.code === "user_banned") {
      return { values, formError: "This account is deactivated. Contact your admin." };
    }
    const badCredentials = error.status === 400;
    return {
      values,
      formError: badCredentials
        ? "Email or password is incorrect."
        : "Sign-in isn't available right now. Try again in a minute.",
    };
  }

  const { data: appUser, error: lookupError } = await getDb()
    .from("app_users")
    .select("is_active, must_change_password")
    .eq("id", data.user.id)
    .maybeSingle();
  if (lookupError) throw lookupError;

  if (!appUser?.is_active) {
    await supabase.auth.signOut({ scope: "local" });
    return { values, formError: "This account is deactivated. Contact your admin." };
  }

  revalidatePath("/", "layout");
  redirect(appUser.must_change_password ? "/change-password" : "/dashboard");
}

export async function logout() {
  const supabase = await createClient();
  await supabase.auth.signOut({ scope: "local" });
  revalidatePath("/", "layout");
  redirect("/login");
}
