import { dayOfDate } from "./dates";
import { effectiveShiftsOn } from "./effective";
import type { CoverageGap, Day, EventRow, RuleViolation, ScheduleChange, Shift } from "./types";
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

export interface Window {
  start: number;
  end: number;
}

/** Time ranges on one day, inside `windows`, where fewer than `minStaff` people are working. */
export function findGapsOnDay(day: Day, shifts: Shift[], windows: Window[], minStaff: number): CoverageGap[] {
  if (windows.length === 0) return [];
  const dayShifts = shifts.filter((x) => x.day === day);
  const lo = Math.min(...windows.map((w) => w.start));
  const hi = Math.max(...windows.map((w) => w.end));

  const points = new Set<number>(windows.flatMap((w) => [w.start, w.end]));
  for (const x of dayShifts) {
    if (x.start > lo && x.start < hi) points.add(x.start);
    if (x.end > lo && x.end < hi) points.add(x.end);
  }
  const sorted = [...points].sort((a, b) => a - b);

  const gaps: CoverageGap[] = [];
  let current: CoverageGap | null = null;
  for (let i = 0; i < sorted.length - 1; i++) {
    const a = sorted[i];
    const b = sorted[i + 1];
    if (!windows.some((w) => w.start <= a && w.end >= b)) {
      current = null;
      continue;
    }
    const have = new Set(dayShifts.filter((x) => x.start <= a && x.end >= b).map((x) => x.staffId)).size;
    if (have < minStaff) {
      if (current && current.end === a && current.have === have) {
        current.end = b;
      } else {
        current = { day, start: a, end: b, have, need: minStaff };
        gaps.push(current);
      }
    } else {
      current = null;
    }
  }
  return gaps;
}

/** Standard afternoon coverage gaps for the whole week. */
export function findCoverageGaps(shifts: Shift[], config: RuleConfig = DEFAULT_CONFIG): CoverageGap[] {
  return DAYS.flatMap((day) =>
    config.coverageExemptDays.includes(day)
      ? []
      : findGapsOnDay(day, shifts, [config.coverageWindow], config.minStaff),
  );
}

/**
 * Gaps on one specific date: the usual afternoon rule, plus any time Pam is away
 * (she is not counted as staff, so when she leaves the girls need 2 people even on Friday).
 */
export function gapsForDate(
  date: string,
  template: Shift[],
  changes: ScheduleChange[],
  events: EventRow[],
  config: RuleConfig = DEFAULT_CONFIG,
): CoverageGap[] {
  const day = dayOfDate(date);
  if (!day) return [];
  const windows: Window[] = [
    ...(config.coverageExemptDays.includes(day) ? [] : [config.coverageWindow]),
    ...events.filter((e) => e.date === date && e.person === "pam").map((e) => ({ start: e.start, end: e.end })),
  ];
  return findGapsOnDay(day, effectiveShiftsOn(date, template, changes), windows, config.minStaff);
}

const GIANNA_EARLIEST_START = t("15:00");
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
  if (shifts.some((x) => x.staffId === "gianna" && (!isAfternoon(x) || x.start < GIANNA_EARLIEST_START))) {
    violations.push({
      rule: "gianna-afternoons-only",
      message: "Gianna can only work afternoons, starting 3:00 PM or later (she's in school before that).",
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
