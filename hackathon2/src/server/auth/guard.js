import { forbidden, unauthorized } from "@/server/errors";

// Route handlers / services: the signed-in actor or AppError 401.
export async function requireActor() {
  const { getActor } = await import("./session");
  const actor = await getActor();
  if (!actor) throw unauthorized();
  return actor;
}

// 401 when signed out, 403 when the role isn't one of `roles`.
export function requireRole(actor, ...roles) {
  if (!actor) throw unauthorized();
  if (!roles.includes(actor.role)) throw forbidden("Your role can't do this.");
  return actor;
}

// Employees may only touch rows where employee_id is their own.
export function assertOwnEmployee(actor, employeeId) {
  if (!actor) throw unauthorized();
  if (!actor.employeeId) throw forbidden("No employee record linked to your account.");
  if (actor.employeeId !== employeeId) throw forbidden("You can only access your own records.");
  return actor;
}
