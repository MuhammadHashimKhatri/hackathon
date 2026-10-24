import { expect, test } from "vitest";
import { TEMP_PASSWORD_ALPHABET, generateTempPassword } from "./tempPassword";

test("temp passwords are 14 readable characters", () => {
  const pw = generateTempPassword();
  expect(pw).toHaveLength(14);
  for (const ch of pw) expect(TEMP_PASSWORD_ALPHABET).toContain(ch);
  expect(pw).not.toMatch(/[0O1lI]/);
});

test("temp passwords don't repeat", () => {
  const seen = new Set(Array.from({ length: 100 }, () => generateTempPassword()));
  expect(seen.size).toBe(100);
});
