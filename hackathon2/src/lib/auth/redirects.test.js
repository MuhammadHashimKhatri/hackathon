import { describe, expect, test } from "vitest";
import { decideRedirect } from "./redirects";

const go = (pathname, state = {}) =>
  decideRedirect({ pathname, signedIn: false, setupCompleted: true, mustChangePassword: false, ...state });

describe("decideRedirect (proxy rules)", () => {
  test("before setup, every page goes to /setup", () => {
    for (const p of ["/", "/login", "/dashboard", "/users"]) expect(go(p, { setupCompleted: false })).toBe("/setup");
    expect(go("/setup", { setupCompleted: false })).toBeNull();
  });

  test("after setup, /setup goes to /login (or /dashboard when signed in)", () => {
    expect(go("/setup")).toBe("/login");
    expect(go("/setup", { signedIn: true })).toBe("/dashboard");
  });

  test("signed out: everything except /login goes to /login", () => {
    expect(go("/dashboard")).toBe("/login");
    expect(go("/change-password")).toBe("/login");
    expect(go("/")).toBe("/login");
    expect(go("/login")).toBeNull();
  });

  test("must change password: everything else goes to /change-password", () => {
    const flagged = { signedIn: true, mustChangePassword: true };
    expect(go("/dashboard", flagged)).toBe("/change-password");
    expect(go("/login", flagged)).toBe("/change-password");
    expect(go("/change-password", flagged)).toBeNull();
  });

  test("signed in: /login and / go to /dashboard, other pages pass", () => {
    const signedIn = { signedIn: true };
    expect(go("/login", signedIn)).toBe("/dashboard");
    expect(go("/", signedIn)).toBe("/dashboard");
    expect(go("/users", signedIn)).toBeNull();
    expect(go("/change-password", signedIn)).toBeNull();
  });

  test("/api is never redirected, whatever the state", () => {
    expect(go("/api/users", { setupCompleted: false })).toBeNull();
    expect(go("/api/users")).toBeNull();
    expect(go("/api/setup/status", { signedIn: true, mustChangePassword: true })).toBeNull();
  });
});
