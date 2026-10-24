import "server-only";
import { z } from "zod";
import { getDb } from "@/server/db";
import { AppError, notFound } from "@/server/errors";
import { audit } from "@/server/audit";
import { requireRole } from "@/server/auth/guard";
import { check } from "@/server/dbErrors";

// Departments and designations. Spec §4 row 04: Admin manages, HR views.

const DUPLICATE_DEPARTMENT = { unique: "A department with this name already exists." };
const DUPLICATE_DESIGNATION = {
  unique: "This designation already exists in that department.",
  foreignKey: "That department no longer exists.",
};

const countOf = (embedded) => embedded?.[0]?.count ?? 0;

function toDesignation(row) {
  return { id: row.id, title: row.title, departmentId: row.department_id, employeeCount: countOf(row.employees) };
}

function assertUuid(id, what) {
  if (!z.uuid().safeParse(id).success) throw notFound(`${what} not found.`);
}

// Everything the organization page needs in two queries.
export async function listOrganization(actor) {
  requireRole(actor, "admin", "hr");
  const db = getDb();
  const [departments, unassigned] = await Promise.all([
    db
      .from("departments")
      .select("id, name, employees(count), designations(id, title, department_id, employees(count))")
      .order("name"),
    db.from("designations").select("id, title, department_id, employees(count)").is("department_id", null).order("title"),
  ]);
  if (departments.error) throw departments.error;
  if (unassigned.error) throw unassigned.error;

  return {
    departments: departments.data.map((d) => ({
      id: d.id,
      name: d.name,
      employeeCount: countOf(d.employees),
      designations: d.designations.map(toDesignation).sort((a, b) => a.title.localeCompare(b.title)),
    })),
    unassignedDesignations: unassigned.data.map(toDesignation),
  };
}

export async function listDepartments(actor) {
  requireRole(actor, "admin", "hr");
  const { data, error } = await getDb().from("departments").select("id, name").order("name");
  if (error) throw error;
  return data;
}

export async function listDesignations(actor, { departmentId } = {}) {
  requireRole(actor, "admin", "hr");
  let query = getDb().from("designations").select("id, title, department_id, employees(count)").order("title");
  if (departmentId) query = query.eq("department_id", departmentId);
  const { data, error } = await query;
  if (error) throw error;
  return data.map(toDesignation);
}

async function findDepartment(id) {
  assertUuid(id, "Department");
  const { data, error } = await getDb()
    .from("departments")
    .select("id, name, employees(count), designations(count)")
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  if (!data) throw notFound("Department not found.");
  return data;
}

export async function createDepartment(actor, { name }) {
  requireRole(actor, "admin");
  const { data, error } = await getDb().from("departments").insert({ name }).select("id, name").single();
  check(error, DUPLICATE_DEPARTMENT);
  await audit(actor, "create", "departments", data.id, null, { name });
  return data;
}

export async function renameDepartment(actor, id, { name }) {
  requireRole(actor, "admin");
  const before = await findDepartment(id);
  const { data, error } = await getDb().from("departments").update({ name }).eq("id", id).select("id, name").single();
  check(error, DUPLICATE_DEPARTMENT);
  await audit(actor, "update", "departments", id, { name: before.name }, { name });
  return data;
}

export async function deleteDepartment(actor, id) {
  requireRole(actor, "admin");
  const dept = await findDepartment(id);
  const employees = countOf(dept.employees);
  const designations = countOf(dept.designations);
  if (employees > 0) {
    throw new AppError(422, "DEPARTMENT_HAS_EMPLOYEES",
      `${dept.name} has ${employees} employee${employees === 1 ? "" : "s"}. Move them to another department first.`);
  }
  if (designations > 0) {
    throw new AppError(422, "DEPARTMENT_HAS_DESIGNATIONS",
      `Delete or move its ${designations} designation${designations === 1 ? "" : "s"} first.`);
  }
  const { error } = await getDb().from("departments").delete().eq("id", id);
  check(error, { foreignKey: "This department is still in use." });
  await audit(actor, "delete", "departments", id, { name: dept.name }, null);
  return { ok: true };
}

async function findDesignation(id) {
  assertUuid(id, "Designation");
  const { data, error } = await getDb()
    .from("designations")
    .select("id, title, department_id, employees(count)")
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  if (!data) throw notFound("Designation not found.");
  return data;
}

export async function createDesignation(actor, { title, departmentId }) {
  requireRole(actor, "admin");
  const { data, error } = await getDb()
    .from("designations")
    .insert({ title, department_id: departmentId })
    .select("id, title, department_id")
    .single();
  check(error, DUPLICATE_DESIGNATION);
  await audit(actor, "create", "designations", data.id, null, { title, department_id: departmentId });
  return toDesignation(data);
}

export async function updateDesignation(actor, id, { title, departmentId }) {
  requireRole(actor, "admin");
  const before = await findDesignation(id);
  const { data, error } = await getDb()
    .from("designations")
    .update({ title, department_id: departmentId })
    .eq("id", id)
    .select("id, title, department_id")
    .single();
  check(error, DUPLICATE_DESIGNATION);
  await audit(actor, "update", "designations", id,
    { title: before.title, department_id: before.department_id },
    { title, department_id: departmentId });
  return toDesignation(data);
}

export async function deleteDesignation(actor, id) {
  requireRole(actor, "admin");
  const designation = await findDesignation(id);
  const employees = countOf(designation.employees);
  if (employees > 0) {
    throw new AppError(422, "DESIGNATION_IN_USE",
      `${employees} employee${employees === 1 ? " has" : "s have"} this designation. Change theirs first.`);
  }
  const { error } = await getDb().from("designations").delete().eq("id", id);
  check(error, { foreignKey: "This designation is still in use." });
  await audit(actor, "delete", "designations", id,
    { title: designation.title, department_id: designation.department_id }, null);
  return { ok: true };
}
