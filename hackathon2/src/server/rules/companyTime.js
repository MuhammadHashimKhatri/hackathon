// Spec §6 — all dates/times are evaluated in company_settings.timezone.
// Dates are "YYYY-MM-DD" strings; instants are Date objects (UTC inside).

const formatters = new Map();
function partsIn(instant, timeZone) {
  let fmt = formatters.get(timeZone);
  if (!fmt) {
    fmt = new Intl.DateTimeFormat("en-CA", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hourCycle: "h23",
    });
    formatters.set(timeZone, fmt);
  }
  return Object.fromEntries(fmt.formatToParts(instant).map((p) => [p.type, p.value]));
}

// The wall-clock date and minute-of-day of an instant in a time zone.
export function localDateTime(instant, timeZone) {
  const p = partsIn(new Date(instant), timeZone);
  return { date: `${p.year}-${p.month}-${p.day}`, minutes: Number(p.hour) * 60 + Number(p.minute) };
}

// How far the zone's wall clock is ahead of UTC at that instant, in ms.
function offsetAt(ms, timeZone) {
  const p = partsIn(new Date(ms), timeZone);
  const wall = Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute, +p.second);
  return wall - Math.floor(ms / 1000) * 1000;
}

// A wall-clock date + "HH:MM" in a time zone -> the UTC instant.
// Two passes so a DST change between the guess and the answer is handled.
export function zonedToUtc(date, time, timeZone) {
  const [y, m, d] = date.split("-").map(Number);
  const [h, min] = time.split(":").map(Number);
  const wall = Date.UTC(y, m - 1, d, h, min);
  let utc = wall - offsetAt(wall, timeZone);
  const second = offsetAt(utc, timeZone);
  if (wall - second !== utc) utc = wall - second;
  return new Date(utc);
}

export function addDays(date, n) {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

// "YYYY-MM" -> { start, end } dates of that month.
export function monthRange(month) {
  const [y, m] = month.split("-").map(Number);
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return { start: `${month}-01`, end: `${month}-${String(last).padStart(2, "0")}` };
}

export function shiftMonth(month, n) {
  const [y, m] = month.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + n, 1));
  return d.toISOString().slice(0, 7);
}

// "HH:MM" of an instant in a time zone (for showing times and correction forms).
export function localTime(instant, timeZone) {
  const p = partsIn(new Date(instant), timeZone);
  return `${p.hour}:${p.minute}`;
}
