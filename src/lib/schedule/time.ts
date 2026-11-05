/** "14:30" -> 870 */
export function t(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}

/** 870 -> "2:30 PM" */
export function fmt(mins: number): string {
  const h24 = Math.floor(mins / 60);
  const m = mins % 60;
  const suffix = h24 >= 12 ? "PM" : "AM";
  const h = h24 % 12 === 0 ? 12 : h24 % 12;
  return `${h}:${String(m).padStart(2, "0")} ${suffix}`;
}

/** Afternoon shifts are those that start at or after 1:00 PM. */
export const AFTERNOON_STARTS_AT = t("13:00");

/** 870, 990 -> "2:30 – 4:30 PM"; 690, 870 -> "11:30 AM – 2:30 PM" */
export function fmtRange(start: number, end: number): string {
  const a = fmt(start);
  const b = fmt(end);
  const sameSuffix = a.slice(-2) === b.slice(-2);
  return `${sameSuffix ? a.slice(0, -3) : a} – ${b}`;
}

/** 870 -> "14:30" for <input type="time"> */
export function toInput(mins: number): string {
  return `${String(Math.floor(mins / 60)).padStart(2, "0")}:${String(mins % 60).padStart(2, "0")}`;
}
