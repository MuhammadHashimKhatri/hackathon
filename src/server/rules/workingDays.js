// Spec §6 Working days — weekday not in weekend_days and not a holiday
import { addDays } from "./companyTime";

// Weekday of a calendar date (0 = Sunday). UTC so the browser/server zone never shifts it.
export const weekdayOf = (date) => new Date(`${date}T00:00:00Z`).getUTCDay();

const asSet = (holidays = []) => (holidays instanceof Set ? holidays : new Set(holidays));

export function isWorkingDay(date, { weekendDays, holidays }) {
  return !weekendDays.includes(weekdayOf(date)) && !asSet(holidays).has(date);
}

// Inclusive; 0 when start > end.
export function countWorkingDays(start, end, { weekendDays, holidays }) {
  const set = asSet(holidays);
  let count = 0;
  for (let d = start; d <= end; d = addDays(d, 1)) {
    if (isWorkingDay(d, { weekendDays, holidays: set })) count += 1;
  }
  return count;
}
