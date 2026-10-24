import { describe, expect, test, vi } from "vitest";

vi.mock("@/server/db", () => ({ getDb: () => ({}) }));
vi.mock("@/server/audit", () => ({ audit: vi.fn() }));
vi.mock("@/server/auth/authAdmin", () => ({}));

const { escapeCell, parseCsv, validateImportRows } = await import("./employeeCsv");

const ENG = "44444444-4444-4444-8444-444444444444";
const lookups = {
  departments: [{ id: ENG, name: "Engineering" }],
  designations: [{ id: "55555555-5555-4555-8555-555555555555", title: "Developer", department_id: ENG }],
  employees: [{ email: "taken@acme.test", employee_code: "EMP-0001" }],
  logins: [
    { id: "u-hr", email: "hr@acme.test", role: "hr", employee_id: null },
    { id: "u-e", email: "emp@acme.test", role: "employee", employee_id: "x" },
  ],
};

const HEADER = "employee_code,full_name,email,phone,address,gender,date_of_birth,department,designation,join_date,status,basic_salary";
const check = (lines) => validateImportRows(parseCsv([HEADER, ...lines].join("\n")), lookups);

test("a clean file has no errors and resolves names to ids", () => {
  const { errors, valid } = check([
    ",Ayesha Khan,ayesha@acme.test,0300-1234567,Karachi,Female,1995-03-01,engineering,Developer,2026-01-05,active,\"50,000\"",
    "EMP-0042,Bilal Ahmed,hr@acme.test,,,,,Engineering,,2026-02-01,,60000",
  ]);
  expect(errors).toEqual([]);
  expect(valid[0]).toMatchObject({ line: 2, employeeCode: null, login: { link: false } });
  expect(valid[0].input).toMatchObject({ departmentId: ENG, gender: "female", basic: 50000, status: "active" });
  // An HR login without an employee record is linked, not duplicated.
  expect(valid[1]).toMatchObject({ employeeCode: "EMP-0042", login: { link: true, userId: "u-hr" } });
});

test("reports every rule with the spreadsheet row number", () => {
  const { errors, valid } = check([
    ",,not-an-email,,,,,Engineering,,2026-01-05,,1000", // row 2: name required, bad email
    ",Dup One,dup@acme.test,,,,,Sales,,2026-13-01,,0", // row 3: unknown dept, bad date, salary 0
    ",Dup Two,DUP@acme.test,,,,,Engineering,,2026-01-05,,1000", // row 4: duplicate email in file
    "EMP-0001,Old Code,new@acme.test,,,,,Engineering,,2026-01-05,,1000", // row 5: code in DB
    ",Taken,taken@acme.test,,,,,Engineering,Chef,2026-01-05,,1000", // row 6: email in DB, unknown designation
    ",Login,emp@acme.test,,,,,Engineering,,2026-01-05,,abc", // row 7: login exists, salary not a number
  ]);
  expect(valid).toEqual([]);
  const at = (row) => Object.fromEntries(errors.filter((e) => e.row === row).map((e) => [e.field, e.reason]));
  expect(at(2)).toMatchObject({ full_name: "Required", email: "Enter a valid email address" });
  expect(at(3)).toMatchObject({ department: 'Unknown department "Sales"', join_date: expect.stringContaining("YYYY-MM-DD"), basic_salary: "Must be more than 0" });
  expect(at(4)).toEqual({ email: "Same email as row 3" });
  expect(at(5)).toEqual({ employee_code: "Already used by another employee" });
  expect(at(6)).toMatchObject({ email: "Already used by EMP-0001", designation: 'No designation "Chef" in Engineering' });
  expect(at(7)).toMatchObject({ email: "A login with this email already exists", basic_salary: "Use a number like 50000" });
});

test("unknown or missing columns are reported on row 1", () => {
  const { errors } = validateImportRows(parseCsv("name,email\nA,a@acme.test"), lookups);
  expect(errors).toContainEqual(expect.objectContaining({ row: 1, field: "name" }));
  expect(errors).toContainEqual({ row: 1, field: "full_name", reason: "Required column is missing" });
});

test("duplicate codes inside the file", () => {
  const { errors } = check([
    "EMP-0100,A,a@acme.test,,,,,Engineering,,2026-01-05,,1000",
    "emp-0100,B,b@acme.test,,,,,Engineering,,2026-01-05,,1000",
  ]);
  expect(errors).toEqual([{ row: 3, field: "employee_code", reason: "Same code as row 2" }]);
});

describe("formula injection guard", () => {
  test("export prefixes formula-like cells; import strips the prefix", () => {
    expect(escapeCell("=HYPERLINK(1)")).toBe("'=HYPERLINK(1)");
    expect(escapeCell("+92 300")).toBe("'+92 300");
    expect(escapeCell("Karachi")).toBe("Karachi");
    const parsed = parseCsv(`${HEADER}\n,A,a@acme.test,'+92 300,,,,Engineering,,2026-01-05,,1000`);
    expect(parsed.rows[0].values.phone).toBe("+92 300");
  });
});
