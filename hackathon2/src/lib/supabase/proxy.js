import { createServerClient } from "@supabase/ssr";
import { NextResponse } from "next/server";
import { decideRedirect } from "@/lib/auth/redirects";

// "Setup done" is remembered for a short while to skip a DB round trip for
// signed-out visitors. /login and /setup always re-check, and the memory
// expires, so running reset.sql brings a running app back to /setup.
const SETUP_MEMORY_MS = 30_000;
let setupKnownCompleteAt = 0;
const setupKnownComplete = () => Date.now() - setupKnownCompleteAt < SETUP_MEMORY_MS;

// One round trip: setup flag + the user's app_users state (fn_proxy_state).
// Plain fetch with the secret key: proxy code can't import "server-only" modules.
async function fetchProxyState(userId) {
  const res = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/rpc/fn_proxy_state`, {
    method: "POST",
    headers: { apikey: process.env.SUPABASE_SECRET_KEY, "Content-Type": "application/json" },
    body: JSON.stringify({ p_user: userId ?? null }),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`fn_proxy_state failed: ${res.status}`);
  return res.json();
}

export async function updateSession(request) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // Session refresh karta hai - is call ko hatana nahi
  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub ?? null;

  const { pathname } = request.nextUrl;
  if (pathname === "/api" || pathname.startsWith("/api/")) return response;

  let state = { setup_completed: setupKnownComplete() };
  if (userId || !state.setup_completed || pathname === "/login" || pathname === "/setup") {
    try {
      state = await fetchProxyState(userId);
      setupKnownCompleteAt = state.setup_completed ? Date.now() : 0;
    } catch (err) {
      // Fail open: pages still check the actor themselves (RoleGate / getPageActor).
      console.error(err);
      return response;
    }
  }

  const target = decideRedirect({
    pathname,
    signedIn: Boolean(userId && state.is_active),
    setupCompleted: Boolean(state.setup_completed),
    mustChangePassword: Boolean(state.must_change_password),
  });
  if (!target || target === pathname) return response;

  const url = request.nextUrl.clone();
  url.pathname = target;
  url.search = "";
  const redirect = NextResponse.redirect(url);
  // Keep any refreshed session cookies on the redirect.
  response.cookies.getAll().forEach((cookie) => redirect.cookies.set(cookie));
  return redirect;
}
