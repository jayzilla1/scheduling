import { DAYS, type Day } from "./types";

const DAY_MS = 86400000;
const ISO = /^\d{4}-\d{2}-\d{2}$/;

export const isIsoDate = (s: unknown): s is string => typeof s === "string" && ISO.test(s) && !Number.isNaN(Date.parse(s));

const toMs = (iso: string) => Date.parse(`${iso}T00:00:00Z`);
const fromMs = (ms: number) => new Date(ms).toISOString().slice(0, 10);

export function addDays(iso: string, n: number): string {
  return fromMs(toMs(iso) + n * DAY_MS);
}

/** Mon-Fri -> that day; Sat/Sun -> null */
export function dayOfDate(iso: string): Day | null {
  const dow = new Date(toMs(iso)).getUTCDay(); // 0 = Sun
  return dow >= 1 && dow <= 5 ? DAYS[dow - 1] : null;
}

/** Monday of the week containing `iso`. Weekends roll forward to the coming Monday. */
export function mondayOf(iso: string): string {
  const dow = new Date(toMs(iso)).getUTCDay();
  const offset = dow === 0 ? 1 : dow === 6 ? 2 : 1 - dow;
  return addDays(iso, offset);
}

export function weekIsoDates(mondayIso: string): Record<Day, string> {
  const out = {} as Record<Day, string>;
  DAYS.forEach((d, i) => (out[d] = addDays(mondayIso, i)));
  return out;
}

/** "2026-11-05" -> "Thu, Nov 5" */
export function prettyDate(iso: string): string {
  return new Intl.DateTimeFormat("en-US", { timeZone: "UTC", weekday: "short", month: "short", day: "numeric" }).format(
    new Date(toMs(iso)),
  );
}
