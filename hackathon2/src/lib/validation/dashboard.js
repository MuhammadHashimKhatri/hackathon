import { z } from "zod";
import { isoDate } from "./organization";

// Dashboard filters live in the URL (?from=&to=&dept=); junk falls back to defaults.
export const dashboardQuery = z.object({
  from: isoDate.optional().catch(undefined),
  to: isoDate.optional().catch(undefined),
  dept: z.uuid().optional().catch(undefined),
});

export const announcementSchema = z.strictObject({
  title: z.string().trim().min(3, "Add a short title").max(120, "Use 120 characters or fewer"),
  body: z.string().trim().min(3, "Write the announcement").max(2000, "Use 2000 characters or fewer"),
});

export const auditQuery = z.object({
  action: z.string().max(40).optional().catch(undefined),
  entity: z.string().max(60).optional().catch(undefined),
  actor: z.uuid().optional().catch(undefined),
  from: isoDate.optional().catch(undefined),
  to: isoDate.optional().catch(undefined),
  page: z.coerce.number().int().min(1).max(1000).catch(1).default(1),
});
