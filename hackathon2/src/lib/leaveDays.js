// Spec §6 Leave — days = working days in [start, end] (weekday not in
// weekendDays, date not a holiday). Pure, so the apply form's live preview and
// the leave service count the same way. Dates are "YYYY-MM-DD"; weekdays come
// from UTC so no time zone can shift them.

const nextDay = (date) => {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
};

export function countLeaveDays(start, end, { weekendDays, holidays = [] }) {
  if (!start || !end || start > end) return 0;
  const off = holidays instanceof Set ? holidays : new Set(holidays);
  let count = 0;
  for (let d = start; d <= end; d = nextDay(d)) {
    if (!weekendDays.includes(new Date(`${d}T00:00:00Z`).getUTCDay()) && !off.has(d)) count += 1;
  }
  return count;
}
