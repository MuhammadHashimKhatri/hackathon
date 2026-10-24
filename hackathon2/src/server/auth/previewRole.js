import "server-only";
import { cookies } from "next/headers";
import { ROLES } from "@/config/navigation";

// TEMP (Prompt 1): lets the UI be previewed per role before real auth exists.
// Prompt 3 deletes this file and uses getActor() from ./session.js instead.
export const PREVIEW_COOKIE = "hcm_preview_role";

export async function getPreviewActor() {
  const value = (await cookies()).get(PREVIEW_COOKIE)?.value;
  const role = ROLES.includes(value) ? value : "admin";
  return { role, email: null };
}
