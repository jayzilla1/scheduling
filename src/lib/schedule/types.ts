export const DAYS = ["mon", "tue", "wed", "thu", "fri"] as const;
export type Day = (typeof DAYS)[number];

export const DAY_LABELS: Record<Day, string> = {
  mon: "Monday",
  tue: "Tuesday",
  wed: "Wednesday",
  thu: "Thursday",
  fri: "Friday",
};

export type StaffId = string;

export interface Staff {
  id: StaffId;
  name: string;
}

/** Times are minutes after midnight (e.g. 14:30 -> 870). */
export interface Shift {
  staffId: StaffId;
  day: Day;
  start: number;
  end: number;
}

export interface CoverageGap {
  day: Day;
  start: number;
  end: number;
  have: number;
  need: number;
}

export interface RuleViolation {
  rule: string;
  message: string;
  day?: Day;
}
