"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
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
  const { error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) {
    const badCredentials = error.status === 400;
    return {
      values,
      formError: badCredentials
        ? "Email or password is incorrect."
        : "Sign-in isn't available right now. Try again in a minute.",
    };
  }

  revalidatePath("/", "layout");
  redirect("/dashboard");
}

export async function logout() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  revalidatePath("/", "layout");
  redirect("/login");
}
