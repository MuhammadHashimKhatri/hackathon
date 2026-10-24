import { z } from "zod";
import { isoDate } from "./organization";

// Shared by the leave pages (client) and the /api/leave routes (server).

export const leaveApplySchema = z
  .strictObject({
    leaveTypeId: z.uuid("Choose a leave type"),
    startDate: isoDate,
    endDate: isoDate,
    reason: z.string().trim().min(3, "Say why you need the leave").max(500, "Use 500 characters or fewer"),
    source: z.enum(["form", "ai"]).default("form"),
  })
  .refine((d) => d.endDate >= d.startDate, { path: ["endDate"], message: "End date must be on or after the start date" })
  .refine((d) => d.startDate.slice(0, 4) === d.endDate.slice(0, 4), {
    path: ["endDate"],
    message: "Apply separately for each year",
  });

export const leaveDecisionSchema = z
  .strictObject({
    decision: z.enum(["approve", "reject"]),
    comment: z.string().trim().max(500, "Use 500 characters or fewer").default(""),
  })
  .refine((d) => d.decision === "approve" || d.comment.length > 0, {
    path: ["comment"],
    message: "Tell the employee why it's rejected",
  });

// URL params: junk falls back to the default instead of failing the page.
export const leaveListQuery = z.object({
  status: z.enum(["pending", "decided", "all"]).catch("pending").default("pending"),
  employee: z.uuid().optional().catch(undefined),
  department: z.uuid().optional().catch(undefined),
  from: isoDate.optional().catch(undefined),
  to: isoDate.optional().catch(undefined),
});

export const yearQuery = z.object({
  year: z.coerce.number().int().min(2000).max(2100).optional().catch(undefined),
});

export const onLeaveQuery = z
  .object({
    from: isoDate,
    to: isoDate,
    department: z.uuid().optional().catch(undefined),
  })
  .refine((d) => d.to >= d.from, { path: ["to"], message: "End date must be on or after the start date" });
