import { z } from "zod";

// Shared by the payroll page (client) and /api/payroll (server).
export const monthValue = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, "Use a month like 2026-10");

export const payrollGenerateSchema = z.strictObject({ month: monthValue });

// URL params: junk falls back to "no month" instead of failing the page.
export const payrollQuery = z.object({ month: monthValue.optional().catch(undefined) });
