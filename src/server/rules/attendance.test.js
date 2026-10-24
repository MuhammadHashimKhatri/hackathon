import { describe, expect, test } from "vitest";
import { recomputeStatus, statusAtCheckIn, statusAtCheckOut } from "./attendanceStatus";
import { countWorkingDays, isWorkingDay } from "./workingDays";
import { addDays, localDateTime, monthRange, shiftMonth, zonedToUtc } from "./companyTime";
import { haversineMeters, isWithinRadius } from "./geo";

const settings = { timezone: "Asia/Karachi", office_start: "09:00:00", grace_minutes: 15, half_day_hours: 5 };
// Karachi is UTC+5 all year: 09:15 PKT = 04:15Z.
const pkt = (hhmmss) => new Date(`2026-10-24T${hhmmss}+05:00`);

describe("status at check-in (Spec §6: late after office_start + grace)", () => {
  test("09:15 is present, 09:16 is late", () => {
    expect(statusAtCheckIn(pkt("09:15:00"), settings)).toBe("present");
    expect(statusAtCheckIn(pkt("09:16:00"), settings)).toBe("late");
  });

  test("minute precision: anything during 09:15 is still present", () => {
    expect(statusAtCheckIn(pkt("09:15:59"), settings)).toBe("present");
  });

  test("early arrivals are present; grace 0 makes 09:01 late", () => {
    expect(statusAtCheckIn(pkt("07:30:00"), settings)).toBe("present");
    expect(statusAtCheckIn(pkt("09:01:00"), { ...settings, grace_minutes: 0 })).toBe("late");
  });

  test("evaluated in the company time zone, not UTC", () => {
    expect(statusAtCheckIn(new Date("2026-10-24T04:16:00Z"), settings)).toBe("late");
    expect(statusAtCheckIn(new Date("2026-10-24T09:16:00Z"), { ...settings, timezone: "UTC" })).toBe("late");
    expect(statusAtCheckIn(new Date("2026-10-24T09:16:00Z"), settings)).toBe("late"); // 14:16 PKT
    expect(statusAtCheckIn(new Date("2026-10-24T03:59:00Z"), settings)).toBe("present"); // 08:59 PKT
  });
});

describe("status at check-out (Spec §6: < half_day_hours -> half_day)", () => {
  const inAt = pkt("09:00:00");
  test("4h59m is a half day, 5h00m keeps the status", () => {
    expect(statusAtCheckOut("present", inAt, pkt("13:59:00"), settings)).toBe("half_day");
    expect(statusAtCheckOut("present", inAt, pkt("14:00:00"), settings)).toBe("present");
    expect(statusAtCheckOut("late", inAt, pkt("14:00:00"), settings)).toBe("late");
  });

  test("half day overrides late", () => {
    expect(statusAtCheckOut("late", pkt("10:00:00"), pkt("12:00:00"), settings)).toBe("half_day");
  });

  test("recompute applies both steps", () => {
    expect(recomputeStatus(pkt("09:30:00"), null, settings)).toBe("late");
    expect(recomputeStatus(pkt("09:30:00"), pkt("18:00:00"), settings)).toBe("late");
    expect(recomputeStatus(pkt("09:00:00"), pkt("11:00:00"), settings)).toBe("half_day");
  });
});

describe("company time", () => {
  test("the local date flips at midnight in the company zone", () => {
    expect(localDateTime(new Date("2026-10-24T18:59:00Z"), "Asia/Karachi")).toEqual({ date: "2026-10-24", minutes: 23 * 60 + 59 });
    expect(localDateTime(new Date("2026-10-24T19:30:00Z"), "Asia/Karachi")).toEqual({ date: "2026-10-25", minutes: 30 });
  });

  test("local wall time -> UTC, including across a DST change", () => {
    expect(zonedToUtc("2026-10-24", "09:00", "Asia/Karachi").toISOString()).toBe("2026-10-24T04:00:00.000Z");
    expect(zonedToUtc("2026-07-01", "09:00", "Europe/London").toISOString()).toBe("2026-07-01T08:00:00.000Z");
    expect(zonedToUtc("2026-12-01", "09:00", "Europe/London").toISOString()).toBe("2026-12-01T09:00:00.000Z");
  });

  test("date helpers", () => {
    expect(addDays("2026-10-31", 1)).toBe("2026-11-01");
    expect(monthRange("2026-02")).toEqual({ start: "2026-02-01", end: "2026-02-28" });
    expect(shiftMonth("2026-01", -1)).toBe("2025-12");
  });
});

describe("working days", () => {
  const opts = { weekendDays: [0, 6], holidays: ["2026-10-26"] };
  test("weekends and holidays are not working days", () => {
    expect(isWorkingDay("2026-10-24", opts)).toBe(false); // Saturday
    expect(isWorkingDay("2026-10-25", opts)).toBe(false); // Sunday
    expect(isWorkingDay("2026-10-26", opts)).toBe(false); // holiday
    expect(isWorkingDay("2026-10-27", opts)).toBe(true);
  });

  test("October 2026 has 22 working days (21 with one holiday)", () => {
    expect(countWorkingDays("2026-10-01", "2026-10-31", { weekendDays: [0, 6], holidays: [] })).toBe(22);
    expect(countWorkingDays("2026-10-01", "2026-10-31", opts)).toBe(21);
    expect(countWorkingDays("2026-10-02", "2026-10-01", opts)).toBe(0);
  });
});

describe("geo", () => {
  test("one degree of latitude is about 111.2 km", () => {
    expect(haversineMeters({ lat: 0, lng: 0 }, { lat: 1, lng: 0 })).toBeCloseTo(111_195, 0);
  });

  test("radius boundary", () => {
    const office = { lat: 24.8607, lng: 67.0011 };
    const north100m = { lat: office.lat + 100 / 111_195, lng: office.lng };
    expect(isWithinRadius(north100m, office, 101)).toBe(true);
    expect(isWithinRadius(north100m, office, 99)).toBe(false);
  });
});
