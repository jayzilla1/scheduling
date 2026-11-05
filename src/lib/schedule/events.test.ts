import { describe, expect, it } from "vitest";
import { buildTemplate, STAFF } from "./data";
import { effectiveShiftsOn } from "./effective";
import { checkStaffRules, gapsForDate } from "./rules";
import { suggestPlans } from "./suggest";
import { t } from "./time";
import type { EventRow, ScheduleChange } from "./types";

// 2026-11-05 is a Thursday, 2026-11-02 a Monday, 2026-11-06 a Friday.
const template = buildTemplate("thu");
const pamAway = (date: string, a: string, b: string): EventRow => ({
  id: 1, title: "Game", person: "pam", date, start: t(a), end: t(b),
});

describe("effective schedule", () => {
  it("removes a window from a shift and merges added time", () => {
    const changes: ScheduleChange[] = [
      { kind: "remove", staffId: "mack", date: "2026-11-05", start: t("15:00"), end: t("16:00") },
      { kind: "add", staffId: "mack", date: "2026-11-05", start: t("15:00"), end: t("16:00") },
    ];
    const mack = effectiveShiftsOn("2026-11-05", template, changes).filter((s) => s.staffId === "mack");
    expect(mack).toEqual([{ staffId: "mack", day: "thu", start: t("14:30"), end: t("17:30") }]);
  });
});

describe("Pam away", () => {
  it("needs 2 staff during her window, even on a Friday", () => {
    const gaps = gapsForDate("2026-11-06", template, [], [pamAway("2026-11-06", "14:30", "17:00")]);
    expect(gaps.length).toBeGreaterThan(0); // Friday: only Mack in the afternoon
    expect(gapsForDate("2026-11-06", template, [], [])).toEqual([]); // normally exempt
  });

  it("suggests Naimah for a short Thursday gap and never Gianna before 3 PM", () => {
    const events = [pamAway("2026-11-05", "14:30", "17:00")];
    const plans = suggestPlans({ date: "2026-11-05", template, changes: [], events, staff: STAFF });
    expect(plans[0].additions).toEqual([{ staffId: "naimah", start: t("14:30"), end: t("15:00") }]);
    expect(plans[0].remaining).toEqual([]);
    for (const p of plans) {
      expect(p.additions.some((a) => a.staffId === "gianna" && a.start < t("15:00"))).toBe(false);
    }
  });
});

describe("staff away", () => {
  it("has no automatic fix when it would break Mack's afternoons-off rule", () => {
    // Naimah out Monday 2:30-4:30 -> Gianna alone. Mack covering would take his 2nd afternoon off.
    const events: EventRow[] = [
      { id: 2, title: "Doctor", person: "naimah", date: "2026-11-02", start: t("14:30"), end: t("16:30") },
    ];
    const changes: ScheduleChange[] = [
      { kind: "remove", staffId: "naimah", date: "2026-11-02", start: t("14:30"), end: t("16:30"), eventId: 2 },
    ];
    expect(gapsForDate("2026-11-02", template, changes, events).length).toBeGreaterThan(0);
    expect(suggestPlans({ date: "2026-11-02", template, changes, events, staff: STAFF })).toEqual([]);
  });
});

describe("Gianna's school hours", () => {
  it("flags a shift starting before 3 PM", () => {
    const shifts = [...template, { staffId: "gianna", day: "tue" as const, start: t("14:30"), end: t("17:30") }];
    expect(checkStaffRules(shifts).map((v) => v.rule)).toContain("gianna-afternoons-only");
  });
});
