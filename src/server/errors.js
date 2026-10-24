import { NextResponse } from "next/server";

export class AppError extends Error {
  constructor(status, code, message, details) {
    super(message);
    this.name = "AppError";
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export const unauthorized = (message = "Not logged in") =>
  new AppError(401, "UNAUTHORIZED", message);
export const forbidden = (message = "Not allowed") =>
  new AppError(403, "FORBIDDEN", message);
export const notFound = (message = "Not found") =>
  new AppError(404, "NOT_FOUND", message);
export const conflict = (message, details) =>
  new AppError(409, "CONFLICT", message, details);
export const unprocessable = (message, details) =>
  new AppError(422, "UNPROCESSABLE", message, details);

// Unknown errors are logged server-side only; the client gets a generic 500
export function toResponse(err) {
  if (err instanceof AppError) {
    const body = { error: { code: err.code, message: err.message } };
    if (err.details !== undefined) body.error.details = err.details;
    return NextResponse.json(body, { status: err.status });
  }

  console.error(err);
  return NextResponse.json(
    { error: { code: "INTERNAL", message: "Something went wrong" } },
    { status: 500 }
  );
}
