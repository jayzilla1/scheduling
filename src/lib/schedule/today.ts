import { mondayOf, weekIsoDates } from "./dates";
import { DAYS, type Day } from "./types";

const TZ = process.env.NEXT_PUBLIC_TIMEZONE || "America/New_York";

const WEEKDAY_TO_DAY: Record<string, Day | null> = {
  Mon: "mon", Tue: "tue", Wed: "wed", Thu: "thu", Fri: "fri", Sat: null, Sun: null,
};

export interface Now {
  /** null on weekends */
  day: Day | null;
  minutes: number;
  hour: number;
  /** today as YYYY-MM-DD in the daycare's time zone */
  todayIso: string;
  /** full dates for each weekday of the current week (Sat/Sun show the coming week) */
  isoDates: Record<Day, string>;
  /** day-of-month for each weekday of the current week (Mon-Fri) */
  dates: Record<Day, number>;
  monthLabel: string;
}

export function getNow(): Now {
  const d = new Date();
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", {
      timeZone: TZ, weekday: "short", year: "numeric", month: "numeric",
      day: "numeric", hour: "numeric", minute: "numeric", hourCycle: "h23",
    }).formatToParts(d).map((p) => [p.type, p.value]),
  );
  const hour = Number(parts.hour);
  const minutes = hour * 60 + Number(parts.minute);

  const todayIso = `${parts.year}-${String(parts.month).padStart(2, "0")}-${String(parts.day).padStart(2, "0")}`;
  const isoDates = weekIsoDates(mondayOf(todayIso));
  const dates = {} as Record<Day, number>;
  DAYS.forEach((day) => (dates[day] = Number(isoDates[day].slice(8))));

  return {
    day: WEEKDAY_TO_DAY[parts.weekday],
    minutes,
    hour,
    todayIso,
    isoDates,
    dates,
    monthLabel: new Intl.DateTimeFormat("en-US", { timeZone: TZ, month: "long" }).format(d),
  };
}
