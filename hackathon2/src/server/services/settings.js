import "server-only";
import { getDb } from "@/server/db";
import { notFound } from "@/server/errors";
import { audit } from "@/server/audit";
import { requireRole } from "@/server/auth/guard";

// Company settings (single row, id = 1). Spec §4 row 03: Admin manages, HR views.
// Changes apply to new records only: nothing already stored is recalculated.

const COLUMNS =
  "company_name, timezone, office_start, grace_minutes, half_day_hours, weekend_days, office_lat, office_lng, office_radius_m, max_gps_accuracy_m, late_penalty_enabled, updated_at";

const num = (v) => (v === null || v === undefined ? null : Number(v));

function toSettings(row) {
  return {
    company_name: row.company_name,
    timezone: row.timezone,
    office_start: String(row.office_start).slice(0, 5),
    grace_minutes: row.grace_minutes,
    half_day_hours: num(row.half_day_hours),
    weekend_days: [...row.weekend_days].sort((a, b) => a - b),
    office_lat: num(row.office_lat),
    office_lng: num(row.office_lng),
    office_radius_m: row.office_radius_m,
    max_gps_accuracy_m: row.max_gps_accuracy_m,
    late_penalty_enabled: row.late_penalty_enabled,
    updated_at: row.updated_at,
  };
}

async function loadSettings() {
  const { data, error } = await getDb().from("company_settings").select(COLUMNS).eq("id", 1).maybeSingle();
  if (error) throw error;
  if (!data) throw notFound("Company setup isn't complete yet.");
  return toSettings(data);
}

export async function getSettings(actor) {
  requireRole(actor, "admin", "hr");
  return loadSettings();
}

const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

// input is validated by settingsSchema (any subset of fields).
export async function updateSettings(actor, input) {
  requireRole(actor, "admin");
  const current = await loadSettings();

  const next = { ...input };
  if (next.weekend_days) next.weekend_days = [...next.weekend_days].sort((a, b) => a - b);

  const before = {};
  const after = {};
  for (const [key, value] of Object.entries(next)) {
    if (!same(current[key], value)) {
      before[key] = current[key];
      after[key] = value;
    }
  }
  if (Object.keys(after).length === 0) return current;

  const { data, error } = await getDb().from("company_settings").update(after).eq("id", 1).select(COLUMNS).single();
  if (error) throw error;

  await audit(actor, "update", "company_settings", 1, before, after);
  return toSettings(data);
}
