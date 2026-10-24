import { z } from "zod";
import { isoDate, name } from "./organization";

// Shared by the employee forms (client) and the /api/employees routes (server).

export const GENDERS = ["male", "female", "other"];
export const EMPLOYEE_STATUSES = ["probation", "active", "exited"];
// `exited` is only reached through the exit action, never by editing.
export const EDITABLE_STATUSES = ["probation", "active"];

export const GENDER_LABELS = { male: "Male", female: "Female", other: "Other" };
export const STATUS_LABELS = { probation: "Probation", active: "Active", exited: "Exited" };

export const PAGE_SIZE = 20;
export const MAX_BASIC = 10_000_000;

const email = z.string().trim().toLowerCase().pipe(z.email("Enter a valid email address"));

// Blank optional text is stored as null.
const optionalText = (max) =>
  z.string().trim().max(max, `Use ${max} characters or fewer`).transform((v) => v || null).nullable();

const phone = optionalText(30).refine((v) => v === null || /^[0-9+()\-\s]+$/.test(v), "Use digits, spaces, + - ( ) only");

export const money = z
  .number("Enter an amount")
  .positive("Must be more than 0")
  .max(MAX_BASIC, "Use 10,000,000 or less")
  .refine((n) => Math.abs(n * 100 - Math.round(n * 100)) < 1e-6, "Use at most 2 decimal places");

// HRA 40% and medical 10% of basic, rounded like the database's generated columns.
export function salaryBreakdown(basic) {
  const round = (n) => Math.round(n * 100) / 100;
  const b = Number(basic) || 0;
  const hra = round(b * 0.4);
  const medical = round(b * 0.1);
  return { basic: b, hra, medical, gross: round(b + hra + medical) };
}

const jobFields = {
  fullName: name("the full name", 100),
  phone: phone.optional(),
  address: optionalText(300).optional(),
  gender: z.enum(GENDERS, "Choose male, female or other").nullable().optional(),
  dateOfBirth: isoDate.nullable().optional(),
  departmentId: z.uuid("Choose a department"),
  designationId: z.uuid("Choose a designation").nullable().optional(),
  joinDate: isoDate,
  status: z.enum(EDITABLE_STATUSES, "Choose probation or active").optional(),
};

const dobBeforeJoin = {
  check: (d) => !d.dateOfBirth || !d.joinDate || d.dateOfBirth < d.joinDate,
  issue: { path: ["dateOfBirth"], message: "Date of birth must be before the join date" },
};

export const registerEmployeeSchema = z
  .strictObject({ ...jobFields, email, basic: money })
  .refine(dobBeforeJoin.check, dobBeforeJoin.issue);

// HR edit: any subset of the job fields. Email is the login and never changes here.
export const updateEmployeeSchema = z
  .strictObject(jobFields)
  .partial()
  .refine((d) => Object.keys(d).length > 0, "Change at least one field")
  .refine(dobBeforeJoin.check, dobBeforeJoin.issue);

// What an employee may change about themselves.
export const SELF_EDITABLE = ["phone", "address"];
export const selfUpdateSchema = z
  .strictObject({ phone: jobFields.phone, address: jobFields.address })
  .refine((d) => Object.keys(d).length > 0, "Change at least one field");

export const exitEmployeeSchema = z.strictObject({ exitDate: isoDate });

export const salarySchema = z.strictObject({ basic: money, effectiveFrom: isoDate });

export const SORTS = ["name", "code", "join_date", "department"];

export const listEmployeesQuery = z.object({
  q: z.string().trim().max(100).optional(),
  department: z.uuid().optional().catch(undefined),
  designation: z.uuid().optional().catch(undefined),
  status: z.enum(EMPLOYEE_STATUSES).optional().catch(undefined),
  page: z.coerce.number().int().min(1).max(10_000).catch(1).default(1),
  sort: z.enum(SORTS).catch("name").default("name"),
  dir: z.enum(["asc", "desc"]).catch("asc").default("asc"),
});
