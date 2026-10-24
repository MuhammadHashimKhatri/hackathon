// Spec §6 Attendance — present / late at check-in, half_day at check-out
import { localDateTime } from "./companyTime";

const HOUR_MS = 3_600_000;

// "09:00" or "09:00:00" -> minutes after midnight.
function minutesOf(time) {
  const [h, m] = String(time).split(":").map(Number);
  return h * 60 + m;
}

// late when the local hh:mm is after office_start + grace (minute precision:
// with 09:00 + 15, anything during 09:15 is present and 09:16 is late).
export function statusAtCheckIn(checkInAt, { timezone, office_start, grace_minutes }) {
  const { minutes } = localDateTime(checkInAt, timezone);
  return minutes > minutesOf(office_start) + Number(grace_minutes) ? "late" : "present";
}

// Worked less than half_day_hours -> half_day (overrides late); otherwise unchanged.
export function statusAtCheckOut(currentStatus, checkInAt, checkOutAt, { half_day_hours }) {
  const worked = new Date(checkOutAt) - new Date(checkInAt);
  return worked < Number(half_day_hours) * HOUR_MS ? "half_day" : currentStatus;
}

// Both steps in order, for rows written in one go (approved corrections).
export function recomputeStatus(checkInAt, checkOutAt, settings) {
  const atCheckIn = statusAtCheckIn(checkInAt, settings);
  return checkOutAt ? statusAtCheckOut(atCheckIn, checkInAt, checkOutAt, settings) : atCheckIn;
}
