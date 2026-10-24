import { describe, expect, test } from "vitest";
import {
  holidaySchema,
  leaveTypeCreateSchema,
  leaveTypeUpdateSchema,
  settingsSchema,
} from "./organization";

const ok = (schema, value) => schema.safeParse(value).success;

describe("settingsSchema", () => {
  test("accepts a partial update", () => {
    expect(ok(settingsSchema, { grace_minutes: 15 })).toBe(true);
    expect(ok(settingsSchema, { timezone: "Asia/Karachi", office_start: "09:00" })).toBe(true);
  });

  test("rejects an empty update and unknown fields", () => {
    expect(ok(settingsSchema, {})).toBe(false);
    expect(ok(settingsSchema, { setup_completed: false })).toBe(false);
  });

  test("rejects an invalid time zone and time", () => {
    expect(ok(settingsSchema, { timezone: "Mars/Olympus" })).toBe(false);
    expect(ok(settingsSchema, { office_start: "25:00" })).toBe(false);
    expect(ok(settingsSchema, { office_start: "9:00" })).toBe(false);
  });

  test("weekend must leave a working day and not repeat days", () => {
    expect(ok(settingsSchema, { weekend_days: [0, 6] })).toBe(true);
    expect(ok(settingsSchema, { weekend_days: [] })).toBe(true);
    expect(ok(settingsSchema, { weekend_days: [0, 1, 2, 3, 4, 5, 6] })).toBe(false);
    expect(ok(settingsSchema, { weekend_days: [6, 6] })).toBe(false);
    expect(ok(settingsSchema, { weekend_days: [7] })).toBe(false);
  });

  test("latitude and longitude come as a pair", () => {
    expect(ok(settingsSchema, { office_lat: 24.86, office_lng: 67.0 })).toBe(true);
    expect(ok(settingsSchema, { office_lat: null, office_lng: null })).toBe(true);
    expect(ok(settingsSchema, { office_lat: 24.86 })).toBe(false);
    expect(ok(settingsSchema, { office_lat: 24.86, office_lng: null })).toBe(false);
    expect(ok(settingsSchema, { office_lat: 91, office_lng: 0 })).toBe(false);
  });

  test("half-day hours in steps of 0.5; empty number fields get a plain message", () => {
    expect(ok(settingsSchema, { half_day_hours: 4.5 })).toBe(true);
    expect(ok(settingsSchema, { half_day_hours: 4.25 })).toBe(false);
    const result = settingsSchema.safeParse({ grace_minutes: Number.NaN });
    expect(result.error.issues[0].message).toBe("Enter a number");
  });
});

describe("leave type schemas", () => {
  test("quota null means unlimited", () => {
    expect(ok(leaveTypeCreateSchema, { code: "unpaid", name: "Unpaid", yearlyQuota: null, isPaid: false })).toBe(true);
  });

  test("only the four known codes", () => {
    expect(ok(leaveTypeCreateSchema, { code: "maternity", name: "M", yearlyQuota: 90, isPaid: true })).toBe(false);
  });

  test("the code can't be changed on update", () => {
    expect(ok(leaveTypeUpdateSchema, { code: "sick", name: "Sick", yearlyQuota: 8, isPaid: true })).toBe(false);
  });
});

describe("holidaySchema", () => {
  test("needs a real date", () => {
    expect(ok(holidaySchema, { date: "2026-12-25", name: "Quaid Day" })).toBe(true);
    expect(ok(holidaySchema, { date: "2026-02-30", name: "Nope" })).toBe(false);
    expect(ok(holidaySchema, { date: "25/12/2026", name: "Nope" })).toBe(false);
  });
});
