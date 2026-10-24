import { z } from "zod";
import { isoDate } from "./organization";

// Shared by the AI panels (client) and /api/ai/* (server).

export const chatSchema = z.strictObject({
  messages: z
    .array(z.strictObject({ role: z.enum(["user", "assistant"]), content: z.string().trim().min(1).max(2000) }))
    .min(1)
    .max(30)
    .refine((m) => m.at(-1).role === "user", "The last message must be from the user"),
});

export const summarySchema = z.strictObject({
  from: isoDate.optional(),
  to: isoDate.optional(),
  dept: z.uuid().optional(),
});

export const smartLeaveSchema = z.strictObject({
  text: z.string().trim().min(5, "Describe the leave you need").max(500, "Use 500 characters or fewer"),
});
