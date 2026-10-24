import { AppError } from "@/server/errors";
import { withApi } from "@/server/http";
import { requireActor, requireRole } from "@/server/auth/guard";
import { importEmployees, MAX_BYTES } from "@/server/services/employeeCsv";

// multipart/form-data with a `file` field. ?dryRun=false creates the employees;
// anything else is a dry run, so a forgotten flag never imports by accident.
export const POST = withApi(async (request) => {
  const actor = requireRole(await requireActor(), "hr"); // before reading the upload
  const dryRun = request.nextUrl.searchParams.get("dryRun") !== "false";

  let file;
  try {
    file = (await request.formData()).get("file");
  } catch {
    throw new AppError(422, "INVALID_UPLOAD", "Upload the CSV as form data in a field named file.");
  }
  if (!file || typeof file.text !== "function") throw new AppError(422, "INVALID_UPLOAD", "Choose a CSV file to upload.");
  if (file.size > MAX_BYTES) throw new AppError(422, "CSV_TOO_LARGE", "The file is larger than 1 MB.");

  const result = await importEmployees(actor, await file.text(), { dryRun });
  return Response.json(result, { status: dryRun ? 200 : 201 });
});
