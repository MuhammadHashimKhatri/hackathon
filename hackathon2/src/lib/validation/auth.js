import { z } from "zod";

// Shared by the public forms (client-side) and the auth API (Prompt 3).

// Trim and lower-case first, then validate (so " HR@Acme.test " is accepted).
const email = z.string().trim().toLowerCase().pipe(z.email("Enter a valid email address"));

const newPassword = z
  .string()
  .min(8, "Use at least 8 characters")
  .max(72, "Use 72 characters or fewer");

export const loginSchema = z.object({
  email,
  password: z.string().min(1, "Enter your password"),
});

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, "Enter your current password"),
    newPassword,
    confirmPassword: z.string(),
  })
  .refine((d) => d.newPassword === d.confirmPassword, {
    path: ["confirmPassword"],
    message: "Passwords don't match",
  })
  .refine((d) => d.newPassword !== d.currentPassword, {
    path: ["newPassword"],
    message: "Choose a password different from the current one",
  });

export const setupCompanySchema = z.object({
  companyName: z.string().trim().min(2, "Enter the company name").max(100, "Use 100 characters or fewer"),
});

export const setupAdminSchema = z
  .object({
    adminEmail: email,
    adminPassword: newPassword,
    confirmPassword: z.string(),
  })
  .refine((d) => d.adminPassword === d.confirmPassword, {
    path: ["confirmPassword"],
    message: "Passwords don't match",
  });

// When the server has ADMIN_PASSWORD, the setup password may be left blank.
export const setupAdminEnvPasswordSchema = z
  .object({
    adminEmail: email,
    adminPassword: z.union([newPassword, z.literal("")]),
    confirmPassword: z.string(),
  })
  .refine((d) => d.adminPassword === d.confirmPassword, {
    path: ["confirmPassword"],
    message: "Passwords don't match",
  });

// ---- API bodies (route handlers parse these) ----

export const setupSchema = z.object({
  companyName: setupCompanySchema.shape.companyName,
  adminEmail: email,
  adminPassword: z
    .union([newPassword, z.literal("")])
    .optional()
    .transform((v) => v || undefined),
});

export const changePasswordApiSchema = z
  .object({
    currentPassword: z.string().min(1, "Enter your current password"),
    newPassword,
  })
  .refine((d) => d.newPassword !== d.currentPassword, {
    path: ["newPassword"],
    message: "Choose a password different from the current one",
  });

// Strict: a `role` field (e.g. "admin") is rejected — this API only creates HR logins.
export const createHrUserSchema = z.strictObject({ email });

export const setActiveSchema = z.strictObject({ isActive: z.boolean() });

// First message per field, ready for <Input error=...>.
export function fieldErrorsOf(zodError) {
  const { fieldErrors } = z.flattenError(zodError);
  return Object.fromEntries(Object.entries(fieldErrors).map(([k, v]) => [k, v?.[0]]));
}
