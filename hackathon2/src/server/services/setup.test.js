import { beforeEach, describe, expect, test, vi } from "vitest";

// In-memory stand-ins for Supabase: company_settings row + fn_complete_setup.
const db = { settings: null, rpcError: null };

vi.mock("@/server/db", () => ({
  getDb: () => ({
    from: () => ({
      select: () => ({
        eq: () => ({ maybeSingle: async () => ({ data: db.settings, error: null }) }),
      }),
    }),
    rpc: async (_name, args) => {
      if (db.rpcError) return { error: db.rpcError };
      if (db.settings?.setup_completed) return { error: { message: "setup_already_completed" } };
      db.settings = { setup_completed: true, company_name: args.p_company };
      return { error: null };
    },
  }),
}));

const authAdmin = vi.hoisted(() => ({
  createAuthUser: vi.fn(async ({ email }) => ({ id: `id-${email}` })),
  deleteAuthUser: vi.fn(async () => {}),
}));
vi.mock("@/server/auth/authAdmin", () => authAdmin);
vi.mock("@/server/audit", () => ({ audit: vi.fn(async () => {}) }));

const { completeSetup, getSetupStatus } = await import("./setup");

const input = { companyName: "Acme", adminEmail: "admin@acme.test", adminPassword: "longpassword" };

beforeEach(() => {
  db.settings = null;
  db.rpcError = null;
  authAdmin.createAuthUser.mockClear();
  authAdmin.deleteAuthUser.mockClear();
  delete process.env.ADMIN_EMAIL;
  delete process.env.ADMIN_PASSWORD;
});

describe("completeSetup", () => {
  test("first call succeeds, second returns 409", async () => {
    await expect(completeSetup(input)).resolves.toEqual({ ok: true });
    await expect(completeSetup(input)).rejects.toMatchObject({ status: 409, code: "SETUP_COMPLETED" });
    expect(authAdmin.createAuthUser).toHaveBeenCalledTimes(1);
  });

  test("a setup that loses the race deletes the login it created and returns 409", async () => {
    db.rpcError = { message: "setup_already_completed" };
    await expect(completeSetup(input)).rejects.toMatchObject({ status: 409 });
    expect(authAdmin.deleteAuthUser).toHaveBeenCalledWith("id-admin@acme.test");
  });

  test("no password and no ADMIN_PASSWORD is 422", async () => {
    await expect(completeSetup({ ...input, adminPassword: undefined })).rejects.toMatchObject({ status: 422 });
    expect(authAdmin.createAuthUser).not.toHaveBeenCalled();
  });

  test("blank password falls back to ADMIN_PASSWORD", async () => {
    process.env.ADMIN_PASSWORD = "from-env-secret";
    await completeSetup({ ...input, adminPassword: undefined });
    expect(authAdmin.createAuthUser).toHaveBeenCalledWith({ email: input.adminEmail, password: "from-env-secret" });
  });
});

describe("getSetupStatus", () => {
  test("suggests ADMIN_EMAIL only before setup and never exposes the password", async () => {
    process.env.ADMIN_EMAIL = "Boss@Acme.test";
    process.env.ADMIN_PASSWORD = "from-env-secret";
    const before = await getSetupStatus();
    expect(before).toEqual({ setupCompleted: false, suggestedEmail: "boss@acme.test", envPasswordAvailable: true });
    expect(JSON.stringify(before)).not.toContain("from-env-secret");

    db.settings = { setup_completed: true };
    expect(await getSetupStatus()).toEqual({ setupCompleted: true, suggestedEmail: null, envPasswordAvailable: false });
  });
});
