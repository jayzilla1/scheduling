import type { CoverageGap, Day, RuleViolation, Shift } from "./types";
import { DAYS } from "./types";
import { AFTERNOON_STARTS_AT, t } from "./time";

export interface RuleConfig {
  /** Window in which 2 staff must be present, Mon-Thu. Assumption: 3:00-5:30 PM. */
  coverageWindow: { start: number; end: number };
  minStaff: number;
  /** Days exempt from the coverage rule. */
  coverageExemptDays: Day[];
}

export const DEFAULT_CONFIG: RuleConfig = {
  coverageWindow: { start: t("15:00"), end: t("17:30") },
  minStaff: 2,
  coverageExemptDays: ["fri"],
};

/** Finds time ranges in the coverage window where fewer than minStaff people are working. */
export function findCoverageGaps(
  shifts: Shift[],
  config: RuleConfig = DEFAULT_CONFIG,
): CoverageGap[] {
  const gaps: CoverageGap[] = [];
  const { start: ws, end: we } = config.coverageWindow;

  for (const day of DAYS) {
    if (config.coverageExemptDays.includes(day)) continue;
    const dayShifts = shifts.filter((x) => x.day === day);

    const points = new Set<number>([ws, we]);
    for (const x of dayShifts) {
      if (x.start > ws && x.start < we) points.add(x.start);
      if (x.end > ws && x.end < we) points.add(x.end);
    }
    const sorted = [...points].sort((a, b) => a - b);

    let current: CoverageGap | null = null;
    for (let i = 0; i < sorted.length - 1; i++) {
      const a = sorted[i];
      const b = sorted[i + 1];
      const staffNow = new Set(
        dayShifts.filter((x) => x.start <= a && x.end >= b).map((x) => x.staffId),
      ).size;
      if (staffNow < config.minStaff) {
        if (current && current.end === a && current.have === staffNow) {
          current.end = b;
        } else {
          current = { day, start: a, end: b, have: staffNow, need: config.minStaff };
          gaps.push(current);
        }
      } else {
        current = null;
      }
    }
  }
  return gaps;
}

const isAfternoon = (x: Shift) => x.start >= AFTERNOON_STARTS_AT;

/** Staff-specific hard rules from Pam. */
export function checkStaffRules(shifts: Shift[]): RuleViolation[] {
  const violations: RuleViolation[] = [];

  // Gianna: max 3 days, never Friday, never 4 days in a row.
  const gDays = new Set(shifts.filter((x) => x.staffId === "gianna").map((x) => x.day));
  if (gDays.size > 3) {
    violations.push({ rule: "gianna-max-days", message: "Gianna is scheduled more than 3 days." });
  }
  if (gDays.has("fri")) {
    violations.push({ rule: "gianna-no-friday", message: "Gianna can't work Friday.", day: "fri" });
  }
  let run = 0;
  for (const d of DAYS) {
    run = gDays.has(d) ? run + 1 : 0;
    if (run >= 4) {
      violations.push({
        rule: "gianna-consecutive",
        message: "Gianna can't work 4 days in a row.",
        day: d,
      });
    }
  }
  if (shifts.some((x) => x.staffId === "gianna" && !isAfternoon(x))) {
    violations.push({
      rule: "gianna-afternoons-only",
      message: "Gianna can only work afternoons (school in the morning).",
    });
  }

  // Mack: needs 2 afternoons off (Friday doesn't count toward this).
  const mackAfternoons = new Set(
    shifts.filter((x) => x.staffId === "mack" && isAfternoon(x)).map((x) => x.day),
  );
  const mackOff = (["mon", "tue", "wed", "thu"] as Day[]).filter((d) => !mackAfternoons.has(d));
  if (mackOff.length < 2) {
    violations.push({
      rule: "mack-afternoons-off",
      message: "Mack needs at least 2 afternoons off (Mon-Thu).",
    });
  }

  return violations;
}
