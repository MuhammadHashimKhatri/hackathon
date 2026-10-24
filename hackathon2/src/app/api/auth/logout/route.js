import { NextResponse } from "next/server";
import { createClient } from "@/server/supabase/sessionClient";

// Plain form POST (no server action), so logout works even on a page loaded
// before the dev server restarted. 303 turns the POST into a GET of /login.
export async function POST(request) {
  const supabase = await createClient();
  await supabase.auth.signOut();
  return NextResponse.redirect(new URL("/login", request.url), 303);
}
