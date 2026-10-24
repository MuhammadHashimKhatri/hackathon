"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { ROLES } from "@/config/navigation";
import { PREVIEW_COOKIE } from "@/server/auth/previewRole";

// TEMP (Prompt 1): removed together with the preview switcher in Prompt 3.
export async function setPreviewRole(role) {
  const parsed = z.enum(ROLES).safeParse(role);
  if (!parsed.success) return;
  (await cookies()).set(PREVIEW_COOKIE, parsed.data, { path: "/", sameSite: "lax", maxAge: 60 * 60 * 24 * 30 });
  revalidatePath("/", "layout");
}
