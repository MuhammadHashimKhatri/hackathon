import { unstable_rethrow } from "next/navigation";
import { AppError, toResponse } from "./errors";

export { parse } from "./validate";

// Wraps a route handler; ctx is passed through untouched (ctx.params is a Promise)
export function withApi(handler) {
  return async (request, ctx) => {
    try {
      return await handler(request, ctx);
    } catch (err) {
      // Let Next's own control flow (redirect, notFound, prerender bail-outs
      // from connection()/cookies()) through instead of turning it into a 500.
      unstable_rethrow(err);
      return toResponse(err);
    }
  };
}

export async function readJson(request) {
  try {
    return await request.json();
  } catch {
    throw new AppError(422, "INVALID_JSON", "Request body must be valid JSON");
  }
}
