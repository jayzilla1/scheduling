import { describe, expect, it } from "vitest";
import { buildTemplate } from "./data";
import { checkStaffRules, findCoverageGaps } from "./rules";
import { t } from "./time";

describe("template schedule", () => {
  it("satisfies all staff rules by default", () => {
    expect(checkStaffRules(buildTemplate())).toEqual([]);
    expect(checkStaffRules(buildTemplate("tue"))).toEqual([]);
  });

  it("with Gianna on Thursday, Tuesday is the one-person afternoon", () => {
    const gaps = findCoverageGaps(buildTemplate("thu"));
    const tue = gaps.filter((g) => g.day === "tue");
    expect(tue.length).toBeGreaterThan(0);
    expect(gaps.filter((g) => g.day === "thu")).toEqual([]);
  });

  it("Wednesday and Thursday have full overlap in the 3:00-5:15 range", () => {
    const gaps = findCoverageGaps(buildTemplate("thu"));
    const wed = gaps.filter((g) => g.day === "wed");
    expect(wed).toEqual([
      { day: "wed", start: t("17:15"), end: t("17:30"), have: 1, need: 2 },
    ]);
  });

  it("never flags Friday", () => {
    expect(findCoverageGaps(buildTemplate()).some((g) => g.day === "fri")).toBe(false);
  });

  it("flags a 4th Gianna day", () => {
    const shifts = [
      ...buildTemplate(),
      { staffId: "gianna", day: "tue" as const, start: t("15:00"), end: t("17:30") },
    ];
    const v = checkStaffRules(shifts).map((x) => x.rule);
    expect(v).toContain("gianna-max-days");
    expect(v).toContain("gianna-consecutive");
  });
});
