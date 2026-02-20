import { describe, expect, it } from "vitest";

import { WEEKDAYS, isWithinWindow } from "../src";

describe("isWithinWindow", () => {
  it("handles cross-midnight windows", () => {
    const lateNight = new Date(2026, 1, 16, 23, 0, 0, 0);
    const earlyNextDay = new Date(2026, 1, 17, 4, 0, 0, 0);
    const noonNextDay = new Date(2026, 1, 17, 12, 0, 0, 0);
    const day = WEEKDAYS[lateNight.getDay()] ?? "mon";

    const window = {
      id: "night",
      days: [day],
      startMinute: 22 * 60,
      endMinute: 6 * 60
    };

    expect(isWithinWindow(lateNight, window)).toBe(true);
    expect(isWithinWindow(earlyNextDay, window)).toBe(true);
    expect(isWithinWindow(noonNextDay, window)).toBe(false);
  });
});
