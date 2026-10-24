import { z } from "zod";

// Shared by the settings forms (client) and the /api routes (server).

export const TIMEZONES = Intl.supportedValuesOf("timeZone");
const timezoneSet = new Set([...TIMEZONES, "UTC"]);

const name = (label, max = 100) =>
  z.string().trim().min(1, `Enter ${label}`).max(max, `Use ${max} characters or fewer`);

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use a valid date").refine(
  (s) => !Number.isNaN(Date.parse(`${s}T00:00:00Z`)) && new Date(`${s}T00:00:00Z`).toISOString().startsWith(s),
  "Use a valid date"
);

// ---- Company settings (PATCH: any subset, at least one field) ----

export const settingsSchema = z
  .object({
    company_name: z.string().trim().min(2, "Enter the company name").max(100, "Use 100 characters or fewer"),
    timezone: z.string().refine((tz) => timezoneSet.has(tz), "Choose a valid time zone"),
    office_start: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Use a time like 09:00"),
    grace_minutes: z.number("Enter a number").int("Use whole minutes").min(0, "Can't be negative").max(240, "Use 240 minutes or fewer"),
    half_day_hours: z
      .number("Enter a number")
      .min(0.5, "Use at least 0.5 hours")
      .max(12, "Use 12 hours or fewer")
      .refine((n) => Number.isInteger(n * 2), "Use steps of 0.5 hours"),
    weekend_days: z
      .array(z.number().int().min(0).max(6))
      .max(6, "Leave at least one working day")
      .refine((days) => new Set(days).size === days.length, "Each day only once"),
    office_lat: z.number("Enter a number").min(-90, "Latitude is between -90 and 90").max(90, "Latitude is between -90 and 90").nullable(),
    office_lng: z.number("Enter a number").min(-180, "Longitude is between -180 and 180").max(180, "Longitude is between -180 and 180").nullable(),
    office_radius_m: z.number("Enter a number").int("Use whole metres").min(10, "Use at least 10 m").max(5000, "Use 5000 m or less"),
    max_gps_accuracy_m: z.number("Enter a number").int("Use whole metres").min(5, "Use at least 5 m").max(1000, "Use 1000 m or less"),
    late_penalty_enabled: z.boolean(),
  })
  .partial()
  .strict()
  .refine((d) => Object.keys(d).length > 0, "Change at least one setting")
  .refine(
    (d) => ("office_lat" in d) === ("office_lng" in d) && (d.office_lat === null) === (d.office_lng === null),
    { path: ["office_lng"], message: "Enter both latitude and longitude, or neither" }
  );

// ---- Departments & designations ----

export const departmentSchema = z.strictObject({ name: name("a department name", 80) });

export const designationSchema = z.strictObject({
  title: name("a designation title", 80),
  departmentId: z.uuid("Choose a department").nullable(),
});

// ---- Leave types ----

export const LEAVE_CODES = ["annual", "sick", "casual", "unpaid"];

export const STANDARD_LEAVE_TYPES = [
  { code: "annual", name: "Annual leave", yearly_quota: 14, is_paid: true },
  { code: "sick", name: "Sick leave", yearly_quota: 8, is_paid: true },
  { code: "casual", name: "Casual leave", yearly_quota: 10, is_paid: true },
  { code: "unpaid", name: "Unpaid leave", yearly_quota: null, is_paid: false },
];

const leaveTypeFields = {
  name: name("a name", 60),
  yearlyQuota: z.number("Enter a number of days").int("Use whole days").min(0, "Can't be negative").max(366, "Use 366 days or fewer").nullable(),
  isPaid: z.boolean(),
};

export const leaveTypeCreateSchema = z.strictObject({
  code: z.enum(LEAVE_CODES, "Choose annual, sick, casual or unpaid"),
  ...leaveTypeFields,
});

// The code is the identity used by smart leave and payroll; it never changes.
export const leaveTypeUpdateSchema = z.strictObject(leaveTypeFields);

// ---- Holidays ----

export const holidaySchema = z.strictObject({ date: isoDate, name: name("a holiday name", 80) });

export const yearSchema = z.coerce.number().int().min(2000).max(2100);
