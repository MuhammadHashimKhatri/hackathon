// Where a page request must go, or null to let it through. Pure, so the
// proxy rules are unit-tested (src/lib/auth/redirects.test.js).
// signedIn = valid session AND an active app_users row.
export function decideRedirect({ pathname, signedIn, setupCompleted, mustChangePassword }) {
  // Route handlers answer 401/403 JSON themselves.
  if (pathname === "/api" || pathname.startsWith("/api/")) return null;

  if (!setupCompleted) return pathname === "/setup" ? null : "/setup";
  if (pathname === "/setup") return signedIn ? "/dashboard" : "/login";

  if (!signedIn) return pathname === "/login" ? null : "/login";

  if (mustChangePassword) return pathname === "/change-password" ? null : "/change-password";

  if (pathname === "/login" || pathname === "/") return "/dashboard";
  return null;
}
