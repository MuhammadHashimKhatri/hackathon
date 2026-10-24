import { z } from "zod";
import { AppError } from "./errors";

// zod parse that fails with the same 422 shape the forms already read.
export function parse(schema, data) {
  const result = schema.safeParse(data);
  if (!result.success) {
    throw new AppError(422, "VALIDATION_ERROR", "Invalid input", {
      fieldErrors: z.flattenError(result.error).fieldErrors,
    });
  }
  return result.data;
}
