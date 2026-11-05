import { dayOfDate, weekIsoDates } from "./dates";
import { DAYS, type ScheduleChange, type Shift } from "./types";

type Span = [number, number];

function subtract(span: Span, cuts: Span[]): Span[] {
  let pieces: Span[] = [span];
  for (const [a, b] of cuts) {
    pieces = pieces.flatMap(([x, y]): Span[] => {
      if (b <= x || a >= y) return [[x, y]];
      const out: Span[] = [];
      if (a > x) out.push([x, a]);
      if (b < y) out.push([b, y]);
      return out;
    });
  }
  return pieces;
}

/** Joins overlapping or touching shifts for the same person on the same day. */
export function mergeShifts(shifts: Shift[]): Shift[] {
  const sorted = [...shifts].sort(
    (a, b) => a.day.localeCompare(b.day) || a.staffId.localeCompare(b.staffId) || a.start - b.start,
  );
  const out: Shift[] = [];
  for (const s of sorted) {
    const last = out[out.length - 1];
    if (last && last.staffId === s.staffId && last.day === s.day && s.start <= last.end) {
      last.end = Math.max(last.end, s.end);
    } else {
      out.push({ ...s });
    }
  }
  return out;
}

/** What actually happens on one date: weekly template, minus removals, plus additions. */
export function effectiveShiftsOn(date: string, template: Shift[], changes: ScheduleChange[]): Shift[] {
  const day = dayOfDate(date);
  if (!day) return [];
  const todays = changes.filter((c) => c.date === date);
  const out: Shift[] = [];
  for (const s of template.filter((x) => x.day === day)) {
    const cuts = todays
      .filter((c) => c.kind === "remove" && c.staffId === s.staffId)
      .map((c): Span => [c.start, c.end]);
    for (const [a, b] of subtract([s.start, s.end], cuts)) out.push({ ...s, start: a, end: b });
  }
  for (const c of todays.filter((x) => x.kind === "add")) {
    out.push({ staffId: c.staffId, day, start: c.start, end: c.end });
  }
  return mergeShifts(out);
}

export function effectiveWeek(mondayIso: string, template: Shift[], changes: ScheduleChange[]): Shift[] {
  const dates = weekIsoDates(mondayIso);
  return DAYS.flatMap((d) => effectiveShiftsOn(dates[d], template, changes));
}
