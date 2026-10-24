// The employee CSV format (import and export). Shared by the import page and the server.

export const CSV_COLUMNS = [
  "employee_code", "full_name", "email", "phone", "address", "gender",
  "date_of_birth", "department", "designation", "join_date", "status", "basic_salary",
];
export const REQUIRED_COLUMNS = ["full_name", "email", "department", "join_date", "basic_salary"];
export const MAX_ROWS = 500;
export const MAX_BYTES = 1_000_000;
