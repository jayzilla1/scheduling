import { dayOfDate, mondayOf } from "./dates";
import { effectiveShiftsOn, effectiveWeek } from "./effective";
import { checkStaffRules, gapsForDate } from "./rules";
import { fmt, fmtRange } from "./time";
import type { CoverageGap, EventRow, ScheduleChange, Shift, Staff } from "./types";

export interface Addition {
  staffId: string;
  start: number;
  end: number;
}

export interface Plan {
  additions: Addition[];
  description: string;
  /** gaps still open after applying this plan (usually none) */
  remaining: CoverageGap[];
  cost: number;
}

interface Args {
  date: string;
  template: Shift[];
  changes: ScheduleChange[];
  events: EventRow[];
  staff: Staff[];
}

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

const asChanges = (date: string, adds: Addition[]): ScheduleChange[] =>
  adds.map((a) => ({ kind: "add", staffId: a.staffId, date, start: a.start, end: a.end }));

/**
 * Finds ways to fix the coverage gaps on `date`. Every suggestion is checked against
 * Pam's hard rules for that whole week, so it never creates a new violation.
 * Returns up to 3 plans, best first. Empty means no automatic fix exists.
 */
export function suggestPlans({ date, template, changes, events, staff }: Args): Plan[] {
  const day = dayOfDate(date);
  if (!day) return [];
  const monday = mondayOf(date);

  const withAdds = (adds: Addition[]) => [...changes, ...asChanges(date, adds)];
  const violationKeys = (adds: Addition[]) =>
    new Set(
      checkStaffRules(effectiveWeek(monday, template, withAdds(adds))).map((v) => `${v.rule}|${v.day ?? ""}`),
    );
  const baseline = violationKeys([]);
  const gapsOf = (adds: Addition[]) => gapsForDate(date, template, withAdds(adds), events);
  const baseShifts = effectiveShiftsOn(date, template, changes);

  // Staff who are away (appointment etc.) can't be asked to cover during that time.
  const away = events.filter((e) => e.date === date && e.person !== "pam");

  function candidates(gap: CoverageGap, cur: Addition[]): (Addition & { cost: number })[] {
    const nowShifts = effectiveShiftsOn(date, template, withAdds(cur));
    const out: (Addition & { cost: number })[] = [];
    for (const p of staff) {
      if (away.some((e) => e.person === p.id && e.start < gap.end && e.end > gap.start)) continue;
      const mine = nowShifts.filter((x) => x.staffId === p.id);
      const open = subtract([gap.start, gap.end], mine.map((x): Span => [x.start, x.end]));
      for (const [a, b] of open) {
        if (b <= a) continue;
        const adjacent = mine.some((x) => x.end === a || x.start === b);
        const cand = { staffId: p.id, start: a, end: b };
        const bad = [...violationKeys([...cur, cand])].some((k) => !baseline.has(k));
        if (bad) continue;
        out.push({ ...cand, cost: b - a + (mine.length === 0 ? 90 : 0) + (adjacent ? 0 : 30) });
      }
    }
    return out.sort((x, y) => x.cost - y.cost);
  }

  function describe(adds: Addition[]): string {
    const nameOf = (id: string) => staff.find((s) => s.id === id)?.name ?? id;
    return adds
      .map((a) => {
        const mine = baseShifts.filter((x) => x.staffId === a.staffId);
        const before = mine.find((x) => x.end === a.start);
        const after = mine.find((x) => x.start === a.end);
        if (before) return `${nameOf(a.staffId)} stays until ${fmt(a.end)} (instead of ${fmt(before.end)})`;
        if (after) return `${nameOf(a.staffId)} starts at ${fmt(a.start)} (instead of ${fmt(after.start)})`;
        return `${nameOf(a.staffId)} works ${fmtRange(a.start, a.end)}`;
      })
      .join(" and ");
  }

  function expand(cur: Addition[], depth: number, branch: boolean): Plan[] {
    const gaps = gapsOf(cur);
    if (gaps.length === 0 || depth >= 4) return cur.length ? [mk(cur, gaps)] : [];
    const cands = candidates(gaps[0], cur);
    if (cands.length === 0) return cur.length ? [mk(cur, gaps)] : [];
    return (branch ? cands.slice(0, 3) : cands.slice(0, 1)).flatMap((c) =>
      expand([...cur, { staffId: c.staffId, start: c.start, end: c.end }], depth + 1, false),
    );
  }

  function mk(adds: Addition[], remaining: CoverageGap[]): Plan {
    const cost = adds.reduce((n, a) => {
      const mine = baseShifts.filter((x) => x.staffId === a.staffId);
      const adjacent = mine.some((x) => x.end === a.start || x.start === a.end);
      return n + (a.end - a.start) + (mine.length === 0 ? 90 : 0) + (adjacent ? 0 : 30);
    }, 0);
    return { additions: adds, description: describe(adds), remaining, cost };
  }

  const seen = new Set<string>();
  return expand([], 0, true)
    .filter((p) => (seen.has(p.description) ? false : (seen.add(p.description), true)))
    .sort((a, b) => a.remaining.length - b.remaining.length || a.cost - b.cost)
    .slice(0, 3);
}
