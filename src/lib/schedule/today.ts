import { DAYS, type Day } from "./types";

const TZ = process.env.NEXT_PUBLIC_TIMEZONE ?? "America/New_York";

const WEEKDAY_TO_DAY: Record<string, Day | null> = {
  Mon: "mon", Tue: "tue", Wed: "wed", Thu: "thu", Fri: "fri", Sat: null, Sun: null,
};

export interface Now {
  /** null on weekends */
  day: Day | null;
  minutes: number;
  hour: number;
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

  // Work out this week's Monday-Friday dates in the daycare's time zone.
  const todayUtc = Date.UTC(Number(parts.year), Number(parts.month) - 1, Number(parts.day));
  const idx = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(parts.weekday);
  const mondayOffset = idx === 0 ? 1 : 1 - idx; // on Sunday show the coming week
  const dates = {} as Record<Day, number>;
  DAYS.forEach((day, i) => {
    dates[day] = new Date(todayUtc + (mondayOffset + i) * 86400000).getUTCDate();
  });

  return {
    day: WEEKDAY_TO_DAY[parts.weekday],
    minutes,
    hour,
    dates,
    monthLabel: new Intl.DateTimeFormat("en-US", { timeZone: TZ, month: "long" }).format(d),
  };
}
