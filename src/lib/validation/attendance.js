import { z } from "zod";
import { isoDate } from "./organization";

// Shared by the attendance pages (client) and the /api/attendance routes (server).

export const BOARD_STATUSES = [
  "present", "late", "half_day", "missing_checkout", "absent", "on_leave", "not_in_yet", "off_day",
];

export const checkInSchema = z
  .strictObject({
    source: z.literal("web", "Only web check-in is available").default("web"),
    lat: z.number().min(-90).max(90).optional(),
    lng: z.number().min(-180).max(180).optional(),
    accuracy: z.number().min(0).max(1_000_000).optional(),
  })
  .refine((d) => (d.lat === undefined) === (d.lng === undefined), {
    path: ["lng"],
    message: "Send both latitude and longitude, or neither",
  });

export const monthSchema = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, "Use a month like 2026-10");

// URL params: junk falls back to the default instead of failing the page.
export const monthQuery = z.object({ month: monthSchema.optional().catch(undefined) });

export const boardQuery = z.object({
  date: isoDate.optional().catch(undefined),
  department: z.uuid().optional().catch(undefined),
  status: z.enum(BOARD_STATUSES).optional().catch(undefined),
  q: z.string().trim().max(100).optional().catch(undefined),
});

const time = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Use a time like 09:00");

export const correctionRequestSchema = z
  .strictObject({
    workDate: isoDate,
    checkIn: time.nullable().optional(),
    checkOut: time.nullable().optional(),
    reason: z.string().trim().min(3, "Say what happened").max(500, "Use 500 characters or fewer"),
  })
  .refine((d) => d.checkIn || d.checkOut, { path: ["checkIn"], message: "Enter the check-in or check-out time to fix" })
  .refine((d) => !d.checkIn || !d.checkOut || d.checkOut > d.checkIn, {
    path: ["checkOut"],
    message: "Check-out must be after check-in",
  });

export const correctionDecisionSchema = z
  .strictObject({
    decision: z.enum(["approve", "reject"]),
    comment: z.string().trim().max(500, "Use 500 characters or fewer").default(""),
  })
  .refine((d) => d.decision === "approve" || d.comment.length > 0, {
    path: ["comment"],
    message: "Tell the employee why it's rejected",
  });

export const correctionListQuery = z.object({
  status: z.enum(["pending", "decided"]).catch("pending").default("pending"),
});
