import { z } from "zod";
import { AppError, toResponse } from "./errors";

// Wraps a route handler; ctx is passed through untouched (ctx.params is a Promise)
export function withApi(handler) {
  return async (request, ctx) => {
    try {
      return await handler(request, ctx);
    } catch (err) {
      return toResponse(err);
    }
  };
}

export function parse(schema, data) {
  const result = schema.safeParse(data);
  if (!result.success) {
    throw new AppError(422, "VALIDATION_ERROR", "Invalid input", {
      fieldErrors: z.flattenError(result.error).fieldErrors,
    });
  }
  return result.data;
}

export async function readJson(request) {
  try {
    return await request.json();
  } catch {
    throw new AppError(422, "INVALID_JSON", "Request body must be valid JSON");
  }
}
